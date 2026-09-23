const { supabaseAdmin } = require('../config/supabaseClient');
const { notify } = require('../services/notificationService');
const { effectiveStatus } = require('../utils/isoStats');
const { sha256, computeSignatureHash } = require('../utils/signature');
const { canManageDocument, downloadBuffer, fail } = require('./documentController');
const logger = require('../utils/logger');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_SIGNATURE_IMAGE = 300000; // caracteres del data URL (~220 KB de PNG)
const MAX_REQUEST_SIGNERS = 25;

const SIGNATURE_SELECT = `
  id, document_id, signer_id, status, requested_by, requested_at, request_message, signed_at,
  signer_name, signer_role, signature_image, document_sha256, signature_hash, comment,
  last_reminded_at, reminder_count,
  signer:profiles!document_signatures_signer_id_fkey(id, name, email, role),
  requester:profiles!document_signatures_requested_by_fkey(id, name)`;

const toApiSignature = (row, { includeImage = true } = {}) => ({
  id: row.id,
  documentId: row.document_id,
  signerId: row.signer_id,
  signerName: row.signer_name || row.signer?.name || null,
  signerEmail: row.signer?.email || null,
  signerRole: row.signer_role || (row.signer?.role ? row.signer.role.toUpperCase() : null),
  status: row.status,
  requestedBy: row.requested_by,
  requestedByName: row.requester?.name || null,
  requestedAt: row.requested_at,
  requestMessage: row.request_message,
  signedAt: row.signed_at,
  signatureImage: includeImage ? row.signature_image : undefined,
  hasImage: Boolean(row.signature_image),
  documentSha256: row.document_sha256,
  signatureHash: row.signature_hash,
  comment: row.comment,
  lastRemindedAt: row.last_reminded_at,
  reminderCount: row.reminder_count,
});

const loadDocument = async (id) => {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, code, title, status, expiry_date, uploaded_by, storage_path, sha256')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const clientIp = (req) => (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim() || null;

// Quien puede pedir, recordar o cancelar firmas: administradores, autor del documento y quien pidió esa firma.
const canManageSignature = (user, doc, signature) =>
  canManageDocument(user, doc) || (signature && signature.requested_by === user.id);

// ----------------------------------------------------------------------------
const getSignatures = async (req, res) => {
  try {
    const doc = await loadDocument(req.params.id);
    if (!doc) return fail(res, 404, 'Documento no encontrado', 'DOCUMENT_NOT_FOUND');

    const { data, error } = await supabaseAdmin
      .from('document_signatures')
      .select(SIGNATURE_SELECT)
      .eq('document_id', doc.id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    res.json({ success: true, data: { signatures: (data || []).map(row => toApiSignature(row)) } });
  } catch (error) {
    logger.error('Error al obtener firmas:', error);
    fail(res, 500, 'Error al obtener las firmas', 'GET_SIGNATURES_ERROR');
  }
};

// Solicita la firma a uno o varios usuarios (y les avisa). Si ya había una solicitud pendiente, la reenvía.
const requestSignatures = async (req, res) => {
  try {
    const doc = await loadDocument(req.params.id);
    if (!doc) return fail(res, 404, 'Documento no encontrado', 'DOCUMENT_NOT_FOUND');
    if (!canManageDocument(req.user, doc)) {
      return fail(res, 403, 'Solo el autor o un administrador puede solicitar firmas', 'FORBIDDEN_SIGNATURE_REQUEST');
    }

    const status = effectiveStatus(doc);
    if (status === 'archivado' || status === 'vencido') {
      return fail(res, 409, `No se puede solicitar firma de un documento ${status}`, 'DOCUMENT_NOT_SIGNABLE');
    }

    const userIds = [...new Set(Array.isArray(req.body?.userIds) ? req.body.userIds.filter(id => UUID_REGEX.test(id)) : [])];
    if (!userIds.length) return fail(res, 400, 'Selecciona al menos un firmante', 'MISSING_SIGNERS');
    if (userIds.length > MAX_REQUEST_SIGNERS) return fail(res, 400, `Máximo ${MAX_REQUEST_SIGNERS} firmantes por solicitud`, 'TOO_MANY_SIGNERS');

    const message = req.body?.message ? String(req.body.message).trim().slice(0, 500) : null;

    const [{ data: profiles, error: profilesError }, { data: existing, error: existingError }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, name').in('id', userIds).eq('active', true),
      supabaseAdmin.from('document_signatures').select('id, signer_id, status').eq('document_id', doc.id).in('signer_id', userIds),
    ]);
    if (profilesError) throw profilesError;
    if (existingError) throw existingError;

    const activeIds = new Set((profiles || []).map(p => p.id));
    const existingBySigner = new Map((existing || []).map(s => [s.signer_id, s]));

    const toCreate = [];
    const toRemind = [];
    const alreadySigned = [];

    userIds.filter(id => activeIds.has(id)).forEach(id => {
      const current = existingBySigner.get(id);
      if (!current) toCreate.push(id);
      else if (current.status === 'firmada') alreadySigned.push(id);
      else toRemind.push(id);
    });

    const now = new Date().toISOString();

    if (toCreate.length) {
      const { error } = await supabaseAdmin.from('document_signatures').insert(
        toCreate.map(signerId => ({
          document_id: doc.id, signer_id: signerId, status: 'pendiente',
          requested_by: req.user.id, requested_at: now, request_message: message,
        }))
      );
      if (error) throw error;
    }

    if (toRemind.length) {
      const { error } = await supabaseAdmin
        .from('document_signatures')
        .update(message ? { last_reminded_at: now, request_message: message } : { last_reminded_at: now })
        .eq('document_id', doc.id)
        .in('signer_id', toRemind)
        .eq('status', 'pendiente');
      if (error) throw error;
    }

    const notifyIds = [...toCreate, ...toRemind];
    if (notifyIds.length) {
      await notify({
        userIds: notifyIds,
        type: 'firma_solicitada',
        severity: 'warning',
        title: `Firma pendiente: ${doc.title}`,
        message: `${req.user.name || req.user.email} te pidió firmar ${doc.code}.${message ? ` "${message}"` : ''}`,
        linkKey: 'documents',
        linkQuery: `doc=${doc.id}&firmar=1`,
        entityType: 'document',
        entityId: doc.id,
        createdBy: req.user.id,
        dedupe: true,
      });
    }

    // Un documento que aún no tiene ninguna firma pasa a "en revisión" mientras se recolectan
    // (vuelve a vigente cuando firman todos). Si ya estaba aprobado, se mantiene vigente.
    if (doc.status === 'vigente' && toCreate.length) {
      const { count: alreadyApproved } = await supabaseAdmin
        .from('document_signatures')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', doc.id)
        .eq('status', 'firmada');
      if (!alreadyApproved) {
        await supabaseAdmin.from('documents').update({ status: 'en_revision' }).eq('id', doc.id);
      }
    }

    logger.info(`Firmas solicitadas para ${doc.code}: ${toCreate.length} nuevas, ${toRemind.length} recordatorios (por ${req.user.email})`);

    res.status(201).json({
      success: true,
      message: `Solicitud enviada a ${notifyIds.length} persona(s)`,
      data: { requested: toCreate.length, reminded: toRemind.length, alreadySigned: alreadySigned.length },
    });
  } catch (error) {
    logger.error('Error al solicitar firmas:', error);
    fail(res, 500, 'Error al solicitar las firmas', 'REQUEST_SIGNATURES_ERROR');
  }
};

// Reenvía la notificación de una firma pendiente ("recordatorio").
const resendSignatureRequest = async (req, res) => {
  try {
    if (!UUID_REGEX.test(req.params.sigId)) return fail(res, 400, 'ID inválido', 'INVALID_ID');

    const doc = await loadDocument(req.params.id);
    if (!doc) return fail(res, 404, 'Documento no encontrado', 'DOCUMENT_NOT_FOUND');

    const { data: signature, error } = await supabaseAdmin
      .from('document_signatures')
      .select('id, signer_id, status, requested_by, reminder_count, signer:profiles!document_signatures_signer_id_fkey(name)')
      .eq('id', req.params.sigId)
      .eq('document_id', doc.id)
      .maybeSingle();
    if (error) throw error;
    if (!signature) return fail(res, 404, 'Solicitud de firma no encontrada', 'SIGNATURE_NOT_FOUND');
    if (signature.status !== 'pendiente') return fail(res, 409, 'Esta firma ya fue emitida', 'ALREADY_SIGNED');
    if (!canManageSignature(req.user, doc, signature)) {
      return fail(res, 403, 'No tienes permiso para reenviar esta solicitud', 'FORBIDDEN_RESEND');
    }

    const { error: updateError } = await supabaseAdmin
      .from('document_signatures')
      .update({ last_reminded_at: new Date().toISOString(), reminder_count: signature.reminder_count + 1 })
      .eq('id', signature.id);
    if (updateError) throw updateError;

    const result = await notify({
      userIds: [signature.signer_id],
      type: 'firma_solicitada',
      severity: 'warning',
      title: `Recordatorio: firma pendiente de ${doc.title}`,
      message: `${req.user.name || req.user.email} te recuerda firmar ${doc.code}.`,
      linkKey: 'documents',
      linkQuery: `doc=${doc.id}&firmar=1`,
      entityType: 'document',
      entityId: doc.id,
      createdBy: req.user.id,
      dedupe: true,
    });

    if (!result.notifications.length) {
      return fail(res, 409, 'El firmante ya no está activo en la plataforma', 'SIGNER_INACTIVE');
    }

    res.json({
      success: true,
      message: `Recordatorio reenviado a ${signature.signer?.name || 'el firmante'}${result.emailed ? ' (incluye correo)' : ''}`,
      data: { reminderCount: signature.reminder_count + 1, emailed: result.emailed > 0 },
    });
  } catch (error) {
    logger.error('Error al reenviar solicitud de firma:', error);
    fail(res, 500, 'Error al reenviar la solicitud', 'RESEND_SIGNATURE_ERROR');
  }
};

const cancelSignatureRequest = async (req, res) => {
  try {
    if (!UUID_REGEX.test(req.params.sigId)) return fail(res, 400, 'ID inválido', 'INVALID_ID');

    const doc = await loadDocument(req.params.id);
    if (!doc) return fail(res, 404, 'Documento no encontrado', 'DOCUMENT_NOT_FOUND');

    const { data: signature, error } = await supabaseAdmin
      .from('document_signatures')
      .select('id, status, requested_by')
      .eq('id', req.params.sigId)
      .eq('document_id', doc.id)
      .maybeSingle();
    if (error) throw error;
    if (!signature) return fail(res, 404, 'Solicitud de firma no encontrada', 'SIGNATURE_NOT_FOUND');
    if (signature.status !== 'pendiente') return fail(res, 409, 'Una firma emitida no se puede cancelar', 'ALREADY_SIGNED');
    if (!canManageSignature(req.user, doc, signature)) {
      return fail(res, 403, 'No tienes permiso para cancelar esta solicitud', 'FORBIDDEN_CANCEL');
    }

    const { error: deleteError } = await supabaseAdmin.from('document_signatures').delete().eq('id', signature.id);
    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Solicitud de firma cancelada' });
  } catch (error) {
    logger.error('Error al cancelar solicitud de firma:', error);
    fail(res, 500, 'Error al cancelar la solicitud', 'CANCEL_SIGNATURE_ERROR');
  }
};

// Firma electrónica del usuario autenticado.
const signDocument = async (req, res) => {
  try {
    const { signatureImage, comment, accept } = req.body || {};

    if (accept !== true) {
      return fail(res, 400, 'Debes aceptar la declaración de firma para continuar', 'TERMS_NOT_ACCEPTED');
    }
    if (signatureImage) {
      if (typeof signatureImage !== 'string' || signatureImage.length > MAX_SIGNATURE_IMAGE || !PNG_DATA_URL.test(signatureImage)) {
        return fail(res, 400, 'La imagen de la firma no es válida (PNG, máx. ~200 KB)', 'INVALID_SIGNATURE_IMAGE');
      }
    }

    const doc = await loadDocument(req.params.id);
    if (!doc) return fail(res, 404, 'Documento no encontrado', 'DOCUMENT_NOT_FOUND');

    const status = effectiveStatus(doc);
    if (status === 'archivado' || status === 'vencido') {
      return fail(res, 409, `No se puede firmar un documento ${status}`, 'DOCUMENT_NOT_SIGNABLE');
    }

    const { data: current, error: currentError } = await supabaseAdmin
      .from('document_signatures')
      .select('id, status, requested_by')
      .eq('document_id', doc.id)
      .eq('signer_id', req.user.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (current?.status === 'firmada') return fail(res, 409, 'Ya firmaste este documento', 'ALREADY_SIGNED');

    // La firma queda ligada al contenido exacto del archivo: si fue alterado, no se firma.
    const buffer = await downloadBuffer(doc.storage_path);
    if (!buffer) return fail(res, 404, 'Archivo no encontrado en el almacenamiento', 'FILE_NOT_FOUND');
    const documentSha256 = sha256(buffer);
    if (doc.sha256 && doc.sha256 !== documentSha256) {
      return fail(res, 409, 'El archivo cambió desde que fue registrado; no es posible firmarlo', 'DOCUMENT_TAMPERED');
    }
    if (!doc.sha256) await supabaseAdmin.from('documents').update({ sha256: documentSha256 }).eq('id', doc.id);

    const signedAt = new Date();
    const signerName = req.user.name || req.user.email;
    const row = {
      status: 'firmada',
      signed_at: signedAt.toISOString(),
      signer_name: signerName,
      signer_role: req.user.role,
      signature_image: signatureImage || null,
      document_sha256: documentSha256,
      signature_hash: computeSignatureHash({
        documentId: doc.id, documentSha256, signerId: req.user.id, signedAt, signerName,
      }),
      comment: comment ? String(comment).trim().slice(0, 500) : null,
      ip_address: clientIp(req),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 300) || null,
    };

    let saved;
    let saveError;
    if (current) {
      ({ data: saved, error: saveError } = await supabaseAdmin
        .from('document_signatures').update(row).eq('id', current.id).select(SIGNATURE_SELECT).single());
      if (saveError) throw saveError;
    } else {
      ({ data: saved, error: saveError } = await supabaseAdmin
        .from('document_signatures')
        .insert({ ...row, document_id: doc.id, signer_id: req.user.id })
        .select(SIGNATURE_SELECT)
        .single());
      if (saveError) throw saveError;
    }

    // Si era la última firma pendiente de un documento en revisión, queda aprobado (vigente).
    const { count: stillPending } = await supabaseAdmin
      .from('document_signatures')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', doc.id)
      .eq('status', 'pendiente');

    let approved = false;
    if (doc.status === 'en_revision' && !stillPending) {
      await supabaseAdmin.from('documents').update({ status: 'vigente' }).eq('id', doc.id);
      approved = true;
    }

    // La notificación de "firma pendiente" de este usuario ya no aplica.
    await supabaseAdmin.from('notifications').delete()
      .eq('user_id', req.user.id).eq('entity_type', 'document').eq('entity_id', doc.id).eq('type', 'firma_solicitada');

    const interested = [...new Set([doc.uploaded_by, current?.requested_by].filter(id => id && id !== req.user.id))];
    if (interested.length) {
      await notify({
        userIds: interested,
        type: 'documento_firmado',
        severity: 'success',
        title: approved ? `Documento aprobado: ${doc.title}` : `Documento firmado: ${doc.title}`,
        message: approved
          ? `${signerName} emitió la última firma pendiente de ${doc.code}; el documento quedó vigente.`
          : `${signerName} firmó ${doc.code}.`,
        linkKey: 'documents',
        linkQuery: `doc=${doc.id}`,
        entityType: 'document',
        entityId: doc.id,
        createdBy: req.user.id,
      });
    }

    logger.info(`Documento firmado: ${doc.code} por ${req.user.email}${approved ? ' (aprobado)' : ''}`);

    res.status(201).json({
      success: true,
      message: approved ? 'Documento firmado y aprobado' : 'Documento firmado correctamente',
      data: { signature: toApiSignature(saved, { includeImage: false }), approved },
    });
  } catch (error) {
    if (/no puede modificarse/i.test(error.message || '')) {
      return fail(res, 409, 'Ya firmaste este documento', 'ALREADY_SIGNED');
    }
    logger.error('Error al firmar documento:', error);
    fail(res, 500, 'Error al firmar el documento', 'SIGN_DOCUMENT_ERROR');
  }
};

module.exports = {
  getSignatures,
  requestSignatures,
  resendSignatureRequest,
  cancelSignatureRequest,
  signDocument,
};

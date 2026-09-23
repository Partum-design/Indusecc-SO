const path = require('path');
const { randomUUID } = require('crypto');
const { supabaseAdmin } = require('../config/supabaseClient');
const { notify } = require('../services/notificationService');
const { getIsoCompliance } = require('../services/isoService');
const { buildDocumentStats, effectiveStatus, isExpiringSoon } = require('../utils/isoStats');
const { sha256, computeSignatureHash } = require('../utils/signature');
const logger = require('../utils/logger');

const BUCKET = 'documents';
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const STORED_STATUSES = ['vigente', 'en_revision', 'vencido', 'archivado'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// La extensión manda: los navegadores a veces envían un MIME vacío o distinto (.docx en Linux, .csv en Windows...).
const FILE_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const resolveFileType = (filename) => {
  const ext = path.extname(String(filename || '')).slice(1).toLowerCase();
  return FILE_TYPES[ext] ? { ext, mimetype: FILE_TYPES[ext] } : null;
};

const safeFileName = (filename) =>
  path.basename(String(filename || 'documento')).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);

// Evita romper (o inyectar en) los filtros .or() de PostgREST.
const sanitizeSearch = (value) => String(value || '').replace(/[,()%*\\"'`]/g, ' ').trim().slice(0, 80);

const isAdmin = (user) => ADMIN_ROLES.includes(user.role);

// El rol Consultor es de solo lectura (consulta, descarga y firma), no incorpora documentos al SGC.
const READ_ONLY_ROLES = ['CONSULTOR'];
const rejectReadOnly = (req, res) => {
  if (!READ_ONLY_ROLES.includes(req.user.role)) return false;
  fail(res, 403, 'El rol Consultor es de solo lectura: puede consultar, descargar y firmar, pero no subir documentos', 'READ_ONLY_ROLE');
  return true;
};

const canManageDocument = (user, doc) => isAdmin(user) || doc.uploaded_by === user.id;

const DOCUMENT_SELECT = '*, uploader:profiles!documents_uploaded_by_fkey(id, name)';

// ----------------------------------------------------------------------------
// Serialización
// ----------------------------------------------------------------------------
const summarizeSignatures = (signatures, userId) => {
  const signed = signatures.filter(s => s.status === 'firmada');
  const pending = signatures.filter(s => s.status === 'pendiente');
  return {
    signed: signed.length,
    pending: pending.length,
    signedByMe: signed.some(s => s.signer_id === userId),
    pendingForMe: pending.some(s => s.signer_id === userId),
    signers: signatures.map(s => ({
      id: s.id,
      signerId: s.signer_id,
      name: s.signer?.name || null,
      status: s.status,
      signedAt: s.signed_at,
    })),
  };
};

const toApiDocument = (doc, signatures = [], userId = null, now = new Date()) => ({
  id: doc.id,
  _id: doc.id, // alias de compatibilidad con vistas antiguas
  code: doc.code,
  title: doc.title,
  filename: doc.storage_path,
  originalName: doc.original_name,
  mimetype: doc.mimetype,
  size: doc.size_bytes,
  type: doc.type,
  category: doc.category,
  clause: doc.clause,
  responsible: doc.responsible,
  description: doc.description,
  version: doc.version,
  sha256: doc.sha256,
  status: effectiveStatus(doc, now),
  storedStatus: doc.status,
  expiringSoon: isExpiringSoon(doc, now),
  uploadedBy: doc.uploaded_by,
  uploadedByName: doc.uploader?.name || null,
  expiryDate: doc.expiry_date,
  createdAt: doc.created_at,
  updatedAt: doc.updated_at,
  signatures: summarizeSignatures(signatures, userId),
});

const loadSignaturesFor = async (documentIds) => {
  const bySignedDoc = new Map();
  for (let i = 0; i < documentIds.length; i += 80) {
    const chunk = documentIds.slice(i, i + 80);
    const { data, error } = await supabaseAdmin
      .from('document_signatures')
      .select('id, document_id, signer_id, status, signed_at, signer:profiles!document_signatures_signer_id_fkey(name)')
      .in('document_id', chunk);
    if (error) throw error;
    (data || []).forEach(sig => {
      if (!bySignedDoc.has(sig.document_id)) bySignedDoc.set(sig.document_id, []);
      bySignedDoc.get(sig.document_id).push(sig);
    });
  }
  return bySignedDoc;
};

// ----------------------------------------------------------------------------
// Utilidades de negocio
// ----------------------------------------------------------------------------
const validateClause = async (clause) => {
  if (!clause) return { ok: true, clause: null };
  const code = String(clause).trim();
  const { data, error } = await supabaseAdmin.from('iso_clauses').select('code, level').eq('code', code).maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, message: `La cláusula ${code} no existe en la norma ISO 9001:2015` };
  if (data.level < 2) return { ok: false, message: 'Selecciona una subcláusula (por ejemplo 4.1), no el punto principal' };
  return { ok: true, clause: data.code };
};

const downloadBuffer = async (storagePath) => {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
};

const generateCode = () => `DOC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 4).toUpperCase()}`;

const fail = (res, status, message, code) => res.status(status).json({ success: false, message, code });

// ----------------------------------------------------------------------------
// Subida: el navegador sube directo a Supabase Storage (Vercel limita el cuerpo a 4.5 MB)
// ----------------------------------------------------------------------------
const createUploadUrl = async (req, res) => {
  if (rejectReadOnly(req, res)) return;
  try {
    const { filename, size } = req.body || {};
    const type = resolveFileType(filename);
    if (!type) {
      return fail(res, 400, `Tipo de archivo no permitido. Formatos válidos: ${Object.keys(FILE_TYPES).join(', ')}`, 'INVALID_FILE_TYPE');
    }

    const sizeBytes = Number(size);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return fail(res, 400, 'Tamaño de archivo inválido', 'INVALID_FILE_SIZE');
    if (sizeBytes > MAX_FILE_SIZE) return fail(res, 413, 'El archivo supera el máximo de 25 MB', 'FILE_TOO_LARGE');

    const storagePath = `${req.user.id}/${randomUUID()}-${safeFileName(filename)}`;
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(storagePath);
    if (error) throw error;

    res.json({
      success: true,
      data: {
        storagePath,
        signedUrl: data.signedUrl,
        token: data.token,
        contentType: type.mimetype,
        maxSize: MAX_FILE_SIZE,
      },
    });
  } catch (error) {
    logger.error('Error al crear URL de subida:', error);
    fail(res, 500, 'No se pudo preparar la subida del archivo', 'UPLOAD_URL_ERROR');
  }
};

// Registra un documento ya subido a Storage (o, por compatibilidad, recibe un multipart pequeño).
const createDocument = async (req, res) => {
  if (rejectReadOnly(req, res)) return;
  const userId = req.user.id;
  const body = req.body || {};
  let storagePath = null;
  let uploadedHere = false;

  try {
    let originalName;
    let buffer;

    if (req.file) {
      originalName = req.file.originalname;
      if (!resolveFileType(originalName)) return fail(res, 400, 'Tipo de archivo no permitido', 'INVALID_FILE_TYPE');
      storagePath = `${userId}/${randomUUID()}-${safeFileName(originalName)}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, req.file.buffer, { contentType: resolveFileType(originalName).mimetype, upsert: false });
      if (uploadError) throw uploadError;
      uploadedHere = true;
      buffer = req.file.buffer;
    } else {
      storagePath = String(body.storagePath || '');
      originalName = String(body.originalName || '');
      if (!storagePath || !originalName) return fail(res, 400, 'Archivo requerido', 'MISSING_FILENAME');
      if (!storagePath.startsWith(`${userId}/`) || storagePath.includes('..')) {
        return fail(res, 403, 'La ruta del archivo no te pertenece', 'INVALID_STORAGE_PATH');
      }
      if (!resolveFileType(originalName)) return fail(res, 400, 'Tipo de archivo no permitido', 'INVALID_FILE_TYPE');

      buffer = await downloadBuffer(storagePath);
      if (!buffer) return fail(res, 400, 'El archivo no llegó al almacenamiento. Vuelve a intentar la subida.', 'FILE_NOT_UPLOADED');
    }

    if (buffer.length > MAX_FILE_SIZE) {
      if (uploadedHere) await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      return fail(res, 413, 'El archivo supera el máximo de 25 MB', 'FILE_TOO_LARGE');
    }

    const clause = await validateClause(body.clause || body.clausula);
    if (!clause.ok) {
      if (uploadedHere) await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      return fail(res, 400, clause.message, 'INVALID_CLAUSE');
    }

    const status = ['vigente', 'en_revision'].includes(body.status) ? body.status : 'vigente';
    const expiry = body.expiryDate || body.vigencia || null;
    if (expiry && !DATE_RE.test(String(expiry))) return fail(res, 400, 'Fecha de vigencia inválida (usa AAAA-MM-DD)', 'INVALID_EXPIRY');

    const type = body.type || body.category || 'Documento';
    const title = String(body.title || body.name || originalName).trim().slice(0, 200);

    const { data: document, error: insertError } = await supabaseAdmin
      .from('documents')
      .insert({
        code: String(body.code || '').trim() || generateCode(),
        title,
        original_name: originalName,
        storage_path: storagePath,
        mimetype: resolveFileType(originalName).mimetype,
        size_bytes: buffer.length,
        sha256: sha256(buffer),
        type,
        category: body.category || type,
        clause: clause.clause,
        responsible: body.responsible || body.resp || '',
        description: body.description || '',
        version: String(body.version || 'v.01').slice(0, 20),
        status,
        uploaded_by: userId,
        expiry_date: expiry,
      })
      .select(DOCUMENT_SELECT)
      .single();

    if (insertError) {
      if (uploadedHere) await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      if (insertError.code === '23505') return fail(res, 409, 'Este archivo ya fue registrado', 'DUPLICATE_DOCUMENT');
      throw insertError;
    }

    logger.info(`Documento creado: ${document.code} (${document.storage_path}) por ${req.user.email}`);

    await notify({
      roles: ADMIN_ROLES,
      exceptUserId: userId,
      type: 'documento_subido',
      severity: 'info',
      title: `Nuevo documento: ${document.title}`,
      message: `${req.user.name || req.user.email} cargó ${document.code}${document.clause ? ` (cláusula ${document.clause})` : ''}.`,
      linkKey: 'documents',
      linkQuery: `doc=${document.id}`,
      entityType: 'document',
      entityId: document.id,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      message: 'Documento cargado exitosamente',
      data: { document: toApiDocument(document, [], userId) },
    });
  } catch (error) {
    logger.error('Error al crear documento:', error);
    fail(res, 500, 'Error al cargar documento', 'CREATE_DOCUMENT_ERROR');
  }
};

// ----------------------------------------------------------------------------
// Consulta
// ----------------------------------------------------------------------------
const getDocuments = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const from = (page - 1) * limit;

    let query = supabaseAdmin
      .from('documents')
      .select(DOCUMENT_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (req.query.status && STORED_STATUSES.includes(req.query.status)) query = query.eq('status', req.query.status);
    if (req.query.category) query = query.eq('category', req.query.category);
    if (req.query.clause) {
      const clause = sanitizeSearch(req.query.clause);
      query = query.or(`clause.eq.${clause},clause.like.${clause}.%`);
    }
    if (req.query.search) {
      const term = sanitizeSearch(req.query.search);
      if (term) query = query.or(`code.ilike.%${term}%,title.ilike.%${term}%,original_name.ilike.%${term}%`);
    }

    const { data: documents, count, error } = await query;
    if (error) throw error;

    const signatures = await loadSignaturesFor(documents.map(d => d.id));
    const now = new Date();

    res.json({
      success: true,
      message: 'Documentos obtenidos exitosamente',
      data: {
        documents: documents.map(d => toApiDocument(d, signatures.get(d.id) || [], req.user.id, now)),
        pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
      },
    });
  } catch (error) {
    logger.error('Error al obtener documentos:', error);
    fail(res, 500, 'Error al obtener documentos', 'GET_DOCUMENTS_ERROR');
  }
};

const getDocumentById = async (req, res) => {
  try {
    const { data: document, error } = await supabaseAdmin
      .from('documents').select(DOCUMENT_SELECT).eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!document) return fail(res, 404, 'Documento no encontrado', 'DOCUMENT_NOT_FOUND');

    const signatures = await loadSignaturesFor([document.id]);
    res.json({ success: true, data: { document: toApiDocument(document, signatures.get(document.id) || [], req.user.id) } });
  } catch (error) {
    logger.error('Error al obtener documento:', error);
    fail(res, 500, 'Error al obtener documento', 'GET_DOCUMENT_ERROR');
  }
};

// Estadísticas que se recalculan solas con cada consulta: documentos, firmas y cumplimiento ISO.
const getDocumentStats = async (req, res) => {
  try {
    const iso = await getIsoCompliance();
    res.json({
      success: true,
      data: {
        stats: buildDocumentStats(iso.documents, iso.signatures, req.user.id),
        iso: iso.summary,
        tree: iso.tree,
      },
    });
  } catch (error) {
    logger.error('Error al calcular estadísticas de documentos:', error);
    fail(res, 500, 'Error al calcular estadísticas', 'DOCUMENT_STATS_ERROR');
  }
};

// URL firmada de corta duración: el navegador descarga directo de Storage (sin pasar por la función).
const getDocumentUrl = async (req, res) => {
  try {
    const { data: document, error } = await supabaseAdmin
      .from('documents').select('id, storage_path, original_name, mimetype').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!document) return fail(res, 404, 'Documento no encontrado', 'DOCUMENT_NOT_FOUND');

    const download = req.query.download === '1' || req.query.download === 'true';
    const expiresIn = 120;
    const { data, error: urlError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(document.storage_path, expiresIn, download ? { download: document.original_name } : undefined);

    if (urlError || !data?.signedUrl) {
      return fail(res, 404, 'Archivo no encontrado en el almacenamiento', 'FILE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: { url: data.signedUrl, expiresIn, filename: document.original_name, mimetype: document.mimetype },
    });
  } catch (error) {
    logger.error('Error al generar URL del documento:', error);
    fail(res, 500, 'Error al obtener el archivo', 'DOCUMENT_URL_ERROR');
  }
};

// ----------------------------------------------------------------------------
// Edición y baja
// ----------------------------------------------------------------------------
const updateDocument = async (req, res) => {
  try {
    const { data: existing, error: findError } = await supabaseAdmin
      .from('documents').select('id, uploaded_by').eq('id', req.params.id).maybeSingle();
    if (findError) throw findError;
    if (!existing) return fail(res, 404, 'Documento no encontrado', 'DOCUMENT_NOT_FOUND');
    if (!canManageDocument(req.user, existing)) {
      return fail(res, 403, 'Solo el autor o un administrador puede editar este documento', 'FORBIDDEN_DOCUMENT');
    }

    const b = req.body || {};
    const update = {};
    if (b.code !== undefined) update.code = String(b.code).trim();
    if (b.title !== undefined) update.title = String(b.title).trim().slice(0, 200);
    if (b.type !== undefined) { update.type = b.type; update.category = b.category || b.type; }
    if (b.responsible !== undefined) update.responsible = b.responsible;
    if (b.description !== undefined) update.description = b.description;
    if (b.version !== undefined) update.version = String(b.version).slice(0, 20);
    if (b.status !== undefined) {
      if (!STORED_STATUSES.includes(b.status)) return fail(res, 400, 'Estado inválido', 'INVALID_STATUS');
      update.status = b.status;
    }
    if (b.clause !== undefined || b.clausula !== undefined) {
      const clause = await validateClause(b.clause ?? b.clausula);
      if (!clause.ok) return fail(res, 400, clause.message, 'INVALID_CLAUSE');
      update.clause = clause.clause;
    }
    if (b.expiryDate !== undefined || b.vigencia !== undefined) {
      const expiry = b.expiryDate ?? b.vigencia ?? null;
      if (expiry && !DATE_RE.test(String(expiry))) return fail(res, 400, 'Fecha de vigencia inválida (usa AAAA-MM-DD)', 'INVALID_EXPIRY');
      update.expiry_date = expiry || null;
    }

    if (!Object.keys(update).length) return fail(res, 400, 'No hay cambios que guardar', 'NO_CHANGES');

    const { data: document, error } = await supabaseAdmin
      .from('documents').update(update).eq('id', req.params.id).select(DOCUMENT_SELECT).single();
    if (error) throw error;

    const signatures = await loadSignaturesFor([document.id]);
    res.json({
      success: true,
      message: 'Documento actualizado exitosamente',
      data: { document: toApiDocument(document, signatures.get(document.id) || [], req.user.id) },
    });
  } catch (error) {
    logger.error('Error al actualizar documento:', error);
    fail(res, 500, 'Error al actualizar documento', 'UPDATE_DOCUMENT_ERROR');
  }
};

const deleteDocument = async (req, res) => {
  try {
    const { data: existing, error: findError } = await supabaseAdmin
      .from('documents').select('id, uploaded_by, storage_path, title, code').eq('id', req.params.id).maybeSingle();
    if (findError) throw findError;
    if (!existing) return fail(res, 404, 'Documento no encontrado', 'DOCUMENT_NOT_FOUND');
    if (!canManageDocument(req.user, existing)) {
      return fail(res, 403, 'Solo el autor o un administrador puede eliminar este documento', 'FORBIDDEN_DOCUMENT');
    }

    // Quien tenía una firma pendiente ya no tiene nada que firmar.
    const { data: pending } = await supabaseAdmin
      .from('document_signatures').select('signer_id').eq('document_id', existing.id).eq('status', 'pendiente');

    const { error } = await supabaseAdmin.from('documents').delete().eq('id', existing.id);
    if (error) throw error;

    await supabaseAdmin.storage.from(BUCKET).remove([existing.storage_path]);
    await supabaseAdmin.from('notifications').delete().eq('entity_type', 'document').eq('entity_id', existing.id);

    logger.info(`Documento eliminado: ${existing.code} por ${req.user.email}`);

    if (existing.uploaded_by !== req.user.id) {
      await notify({
        userIds: [existing.uploaded_by],
        type: 'documento_eliminado',
        severity: 'warning',
        title: `Documento eliminado: ${existing.title}`,
        message: `${req.user.name || req.user.email} eliminó ${existing.code} del sistema.`,
        linkKey: 'documents',
        createdBy: req.user.id,
      });
    }
    const pendingIds = (pending || []).map(p => p.signer_id).filter(id => id !== req.user.id && id !== existing.uploaded_by);
    if (pendingIds.length) {
      await notify({
        userIds: pendingIds,
        type: 'firma_cancelada',
        severity: 'info',
        title: `Firma cancelada: ${existing.title}`,
        message: 'El documento fue eliminado, ya no necesitas firmarlo.',
        linkKey: 'documents',
        createdBy: req.user.id,
      });
    }

    res.json({ success: true, message: 'Documento eliminado exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar documento:', error);
    fail(res, 500, 'Error al eliminar documento', 'DELETE_DOCUMENT_ERROR');
  }
};

// Comprueba que el archivo actual sigue siendo el mismo que se registró y que cada firma es válida.
const verifyDocument = async (req, res) => {
  try {
    const { data: document, error } = await supabaseAdmin
      .from('documents').select('id, storage_path, sha256').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!document) return fail(res, 404, 'Documento no encontrado', 'DOCUMENT_NOT_FOUND');

    const buffer = await downloadBuffer(document.storage_path);
    if (!buffer) return fail(res, 404, 'Archivo no encontrado en el almacenamiento', 'FILE_NOT_FOUND');

    const currentSha256 = sha256(buffer);
    const { data: signatures, error: sigError } = await supabaseAdmin
      .from('document_signatures')
      .select('id, signer_id, signer_name, signed_at, document_sha256, signature_hash')
      .eq('document_id', document.id)
      .eq('status', 'firmada');
    if (sigError) throw sigError;

    res.json({
      success: true,
      data: {
        fileIntact: !document.sha256 || document.sha256 === currentSha256,
        registeredSha256: document.sha256,
        currentSha256,
        signatures: (signatures || []).map(sig => ({
          id: sig.id,
          signerName: sig.signer_name,
          signedAt: sig.signed_at,
          valid:
            sig.document_sha256 === currentSha256 &&
            sig.signature_hash === computeSignatureHash({
              documentId: document.id,
              documentSha256: sig.document_sha256,
              signerId: sig.signer_id,
              signedAt: sig.signed_at,
              signerName: sig.signer_name,
            }),
        })),
      },
    });
  } catch (error) {
    logger.error('Error al verificar documento:', error);
    fail(res, 500, 'Error al verificar el documento', 'VERIFY_DOCUMENT_ERROR');
  }
};

module.exports = {
  BUCKET,
  MAX_FILE_SIZE,
  DOCUMENT_SELECT,
  createUploadUrl,
  createDocument,
  getDocuments,
  getDocumentById,
  getDocumentStats,
  getDocumentUrl,
  updateDocument,
  deleteDocument,
  verifyDocument,
  // usados por signatureController
  canManageDocument,
  downloadBuffer,
  isAdmin,
  fail,
};

const { supabaseAdmin } = require('../config/supabaseClient');
const { FRONTEND_URL, DEMO_EMAIL_DOMAIN } = require('../config/environment');
const { resolveLink } = require('../utils/roleLinks');
const sendEmail = require('../utils/email');
const logger = require('../utils/logger');

const SEVERITY_COLOR = { info: '#2563EB', success: '#16A34A', warning: '#D97706', error: '#DC2626' };

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Las cuentas de acceso rápido no tienen buzón real: nunca se les manda correo.
const isDemoEmail = (email) =>
  typeof email === 'string' && email.toLowerCase().startsWith('demo-') && email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);

const buildEmail = ({ recipient, title, message, link, severity }) => {
  const color = SEVERITY_COLOR[severity] || SEVERITY_COLOR.info;
  const url = link ? `${FRONTEND_URL}${link}` : FRONTEND_URL;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #8B0000; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">${escapeHtml(title)}</h2>
      <p>Hola, <strong>${escapeHtml(recipient.name)}</strong>.</p>
      ${message ? `<div style="background:#f9f9f9;padding:15px;border-radius:5px;margin:20px 0;border-left:4px solid ${color};">${escapeHtml(message)}</div>` : ''}
      <div style="text-align:center;margin:28px 0;">
        <a href="${escapeHtml(url)}" style="background-color:#8B0000;color:#fff;padding:12px 25px;text-decoration:none;border-radius:5px;font-weight:bold;">Abrir en Indusecc SGC</a>
      </div>
      <hr />
      <p style="font-size:0.7em;color:#999;">Indusecc SGC - Sistema de Gestión de Calidad</p>
    </div>`;
  return { html, text: `${title}\n\n${message || ''}\n\n${url}` };
};

// Correo en modo "mejor esfuerzo": nunca rompe la operación que lo originó.
const deliverEmail = async (recipient, payload) => {
  if (!recipient.email || isDemoEmail(recipient.email)) return false;
  try {
    const { html, text } = buildEmail({ recipient, ...payload });
    await sendEmail({ email: recipient.email, subject: payload.title, message: text, html });
    return true;
  } catch (err) {
    if (!/no configurado/i.test(err.message || '')) {
      logger.warn(`No se pudo enviar correo a ${recipient.email}: ${err.message}`);
    }
    return false;
  }
};

const resolveRecipients = async ({ userIds = [], roles = [], exceptUserId = null }) => {
  const byId = new Map();

  if (userIds.length) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, role')
      .in('id', [...new Set(userIds.filter(Boolean))])
      .eq('active', true);
    if (error) throw error;
    (data || []).forEach(p => byId.set(p.id, p));
  }

  if (roles.length) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, role')
      .in('role', roles.map(r => r.toLowerCase()))
      .eq('active', true);
    if (error) throw error;
    (data || []).forEach(p => byId.set(p.id, p));
  }

  if (exceptUserId) byId.delete(exceptUserId);
  return [...byId.values()];
};

/**
 * Crea notificaciones internas (y correo si está configurado).
 *
 * @param {object} opts
 * @param {string[]} [opts.userIds]     destinatarios por id
 * @param {string[]} [opts.roles]       destinatarios por rol (SUPER_ADMIN, ADMIN, ...)
 * @param {string}   [opts.exceptUserId] no notificar a quien originó la acción
 * @param {string}   opts.title
 * @param {string}   [opts.message]
 * @param {string}   [opts.type]        categoria libre (documento_subido, firma_solicitada, ...)
 * @param {string}   [opts.severity]    info | success | warning | error
 * @param {string}   [opts.linkKey]     documents | tasks | audits | findings | calendar | users | notifications
 * @param {string}   [opts.linkQuery]   querystring sin '?' (ej. "doc=<id>")
 * @param {string}   [opts.entityType]
 * @param {string}   [opts.entityId]
 * @param {string}   [opts.createdBy]
 * @param {boolean}  [opts.dedupe]      si ya existe una para (usuario, entidad, tipo) se REENVÍA en lugar de duplicar
 * @param {boolean}  [opts.email=true]
 * @returns {Promise<{ notifications: object[], emailed: number }>} nunca lanza
 */
const notify = async (opts) => {
  const {
    title, message = null, type = 'info', severity = 'info', linkKey = 'notifications', linkQuery = null,
    entityType = null, entityId = null, createdBy = null, dedupe = false, email = true,
  } = opts;

  try {
    const recipients = await resolveRecipients(opts);
    if (!recipients.length) return { notifications: [], emailed: 0 };

    const created = [];
    let emailed = 0;

    await Promise.all(recipients.map(async (recipient) => {
      const link = resolveLink(linkKey, recipient.role.toUpperCase(), linkQuery);
      let row = null;

      if (dedupe && entityType && entityId) {
        const { data: existing } = await supabaseAdmin
          .from('notifications')
          .select('id, resend_count')
          .eq('user_id', recipient.id)
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .eq('type', type)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          const { data: updated, error } = await supabaseAdmin
            .from('notifications')
            .update({
              title, message, severity, link, read_at: null,
              resend_count: existing.resend_count + 1,
              last_sent_at: new Date().toISOString(),
              created_by: createdBy,
            })
            .eq('id', existing.id)
            .select('*')
            .single();
          if (error) throw error;
          row = updated;
        }
      }

      if (!row) {
        const { data: inserted, error } = await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: recipient.id, type, severity, title, message, link,
            entity_type: entityType, entity_id: entityId, created_by: createdBy,
          })
          .select('*')
          .single();
        if (error) throw error;
        row = inserted;
      }

      created.push(row);

      if (email && await deliverEmail(recipient, { title, message, link, severity })) {
        emailed += 1;
        await supabaseAdmin.from('notifications').update({ email_sent_at: new Date().toISOString() }).eq('id', row.id);
      }
    }));

    return { notifications: created, emailed };
  } catch (err) {
    logger.error('No se pudo crear la notificación:', err);
    return { notifications: [], emailed: 0 };
  }
};

/**
 * Reenvía una notificación existente: vuelve a marcarla como no leída, incrementa
 * el contador de reenvíos y reintenta el correo.
 */
const resendNotification = async (notificationId) => {
  const { data: current, error } = await supabaseAdmin
    .from('notifications')
    .select('*, recipient:profiles!notifications_user_id_fkey(id, name, email, active)')
    .eq('id', notificationId)
    .maybeSingle();

  if (error) throw error;
  if (!current) return null;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: null, resend_count: current.resend_count + 1, last_sent_at: new Date().toISOString() })
    .eq('id', notificationId)
    .select('*')
    .single();
  if (updateError) throw updateError;

  let emailed = false;
  if (current.recipient?.active) {
    emailed = await deliverEmail(current.recipient, {
      title: current.title, message: current.message, link: current.link, severity: current.severity,
    });
    if (emailed) {
      await supabaseAdmin.from('notifications').update({ email_sent_at: new Date().toISOString() }).eq('id', notificationId);
    }
  }

  return { notification: updated, emailed };
};

const toApiNotification = (row) => ({
  id: row.id,
  type: row.type,
  severity: row.severity,
  title: row.title,
  message: row.message,
  link: row.link,
  entityType: row.entity_type,
  entityId: row.entity_id,
  createdBy: row.created_by,
  read: Boolean(row.read_at),
  readAt: row.read_at,
  resendCount: row.resend_count,
  lastSentAt: row.last_sent_at,
  emailSent: Boolean(row.email_sent_at),
  createdAt: row.created_at,
  recipient: row.recipient ? { id: row.recipient.id, name: row.recipient.name, email: row.recipient.email } : undefined,
});

module.exports = { notify, resendNotification, toApiNotification, escapeHtml, isDemoEmail };

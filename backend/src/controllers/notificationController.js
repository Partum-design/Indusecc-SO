const { supabaseAdmin } = require('../config/supabaseClient');
const { notify, resendNotification, toApiNotification } = require('../services/notificationService');
const logger = require('../utils/logger');

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'COLABORADOR', 'CONSULTOR'];

const serverError = (res, message, code) =>
  res.status(500).json({ success: false, message, code });

// Notificaciones del usuario autenticado + contador de no leídas (sirve para el "polling" del icono de campana).
const getMyNotifications = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const from = (page - 1) * limit;

    let query = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (req.query.unread === 'true') query = query.is('read_at', null);

    const [{ data, count, error }, { count: unreadCount, error: unreadError }] = await Promise.all([
      query,
      supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .is('read_at', null),
    ]);

    if (error) throw error;
    if (unreadError) throw unreadError;

    res.json({
      success: true,
      data: {
        notifications: (data || []).map(toApiNotification),
        unreadCount: unreadCount || 0,
        pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
      },
    });
  } catch (error) {
    logger.error('Error al obtener notificaciones:', error);
    serverError(res, 'Error al obtener notificaciones', 'GET_NOTIFICATIONS_ERROR');
  }
};

// Notificaciones que YO envié (para poder reenviarlas y ver si ya se leyeron).
const getSentNotifications = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*, recipient:profiles!notifications_user_id_fkey(id, name, email)')
      .eq('created_by', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json({ success: true, data: { notifications: (data || []).map(toApiNotification) } });
  } catch (error) {
    logger.error('Error al obtener notificaciones enviadas:', error);
    serverError(res, 'Error al obtener notificaciones enviadas', 'GET_SENT_NOTIFICATIONS_ERROR');
  }
};

const markAsRead = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Notificación no encontrada', code: 'NOTIFICATION_NOT_FOUND' });

    res.json({ success: true, data: { notification: toApiNotification(data) } });
  } catch (error) {
    logger.error('Error al marcar notificación:', error);
    serverError(res, 'Error al marcar la notificación', 'MARK_READ_ERROR');
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', req.user.id)
      .is('read_at', null)
      .select('id');

    if (error) throw error;
    res.json({ success: true, data: { updated: data?.length || 0 } });
  } catch (error) {
    logger.error('Error al marcar todas las notificaciones:', error);
    serverError(res, 'Error al marcar las notificaciones', 'MARK_ALL_READ_ERROR');
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Notificación no encontrada', code: 'NOTIFICATION_NOT_FOUND' });

    res.json({ success: true, message: 'Notificación eliminada' });
  } catch (error) {
    logger.error('Error al eliminar notificación:', error);
    serverError(res, 'Error al eliminar la notificación', 'DELETE_NOTIFICATION_ERROR');
  }
};

// Elimina todas las ya leídas (limpieza de bandeja).
const clearRead = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', req.user.id)
      .not('read_at', 'is', null)
      .select('id');

    if (error) throw error;
    res.json({ success: true, data: { deleted: data?.length || 0 } });
  } catch (error) {
    logger.error('Error al limpiar notificaciones:', error);
    serverError(res, 'Error al limpiar las notificaciones', 'CLEAR_NOTIFICATIONS_ERROR');
  }
};

// Reenviar: solo quien la envió o un administrador.
const resend = async (req, res) => {
  try {
    const { data: existing, error } = await supabaseAdmin
      .from('notifications')
      .select('id, created_by')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!existing) return res.status(404).json({ success: false, message: 'Notificación no encontrada', code: 'NOTIFICATION_NOT_FOUND' });

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
    if (existing.created_by !== req.user.id && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Solo quien envió la notificación o un administrador puede reenviarla', code: 'FORBIDDEN_RESEND' });
    }

    const result = await resendNotification(req.params.id);
    res.json({
      success: true,
      message: result.emailed ? 'Notificación reenviada (incluye correo)' : 'Notificación reenviada',
      data: { notification: toApiNotification(result.notification), emailed: result.emailed },
    });
  } catch (error) {
    logger.error('Error al reenviar notificación:', error);
    serverError(res, 'Error al reenviar la notificación', 'RESEND_NOTIFICATION_ERROR');
  }
};

// Aviso manual de un administrador a usuarios concretos o a todo un rol.
const sendManual = async (req, res) => {
  try {
    const { userIds, role, title, message, severity } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'El título es obligatorio', code: 'MISSING_TITLE' });
    }
    const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
    const roles = role ? [String(role).toUpperCase()] : [];
    if (roles.some(r => !ROLES.includes(r))) {
      return res.status(400).json({ success: false, message: 'Rol inválido', code: 'INVALID_ROLE' });
    }
    if (!ids.length && !roles.length) {
      return res.status(400).json({ success: false, message: 'Selecciona al menos un destinatario o un rol', code: 'MISSING_RECIPIENTS' });
    }

    const result = await notify({
      userIds: ids,
      roles,
      exceptUserId: null,
      title: String(title).trim().slice(0, 140),
      message: message ? String(message).trim().slice(0, 1000) : null,
      type: 'aviso',
      severity: ['info', 'success', 'warning', 'error'].includes(severity) ? severity : 'info',
      linkKey: 'notifications',
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: `Aviso enviado a ${result.notifications.length} usuario(s)`,
      data: { sent: result.notifications.length, emailed: result.emailed },
    });
  } catch (error) {
    logger.error('Error al enviar aviso:', error);
    serverError(res, 'Error al enviar el aviso', 'SEND_NOTIFICATION_ERROR');
  }
};

module.exports = {
  getMyNotifications,
  getSentNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearRead,
  resend,
  sendManual,
};

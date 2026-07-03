const { supabaseAdmin } = require('../config/supabaseClient');
const logger = require('../utils/logger');
const sendEmail = require('../utils/email');

const STATUS_TO_DB = { 'Pendiente': 'pendiente', 'En Progreso': 'en_progreso', 'Completada': 'completada' };
const STATUS_FROM_DB = { pendiente: 'Pendiente', en_progreso: 'En Progreso', completada: 'Completada' };
const VALID_STATUSES = Object.keys(STATUS_TO_DB);

const toApiAudit = (row) => ({
  id: row.id,
  _id: row.id,
  title: row.title,
  description: row.description,
  date: row.date,
  status: STATUS_FROM_DB[row.status] || row.status,
  assignedTo: row.assigned_to_profile
    ? { _id: row.assigned_to_profile.id, id: row.assigned_to_profile.id, name: row.assigned_to_profile.name, email: row.assigned_to_profile.email }
    : row.assigned_to,
  createdBy: row.created_by_profile
    ? { _id: row.created_by_profile.id, id: row.created_by_profile.id, name: row.created_by_profile.name, email: row.created_by_profile.email }
    : row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const SELECT_WITH_JOINS = '*, assigned_to_profile:profiles!audits_assigned_to_fkey(id, name, email), created_by_profile:profiles!audits_created_by_fkey(id, name, email)';

const notifyAssignment = async (assignedToId, audit, subject, heading) => {
  if (!assignedToId) return;
  try {
    const { data: user } = await supabaseAdmin.from('profiles').select('name, email').eq('id', assignedToId).maybeSingle();
    if (!user?.email) return;

    const auditDate = new Date(audit.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #8B0000; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">${heading}</h2>
        <p>Hola, <strong>${user.name}</strong>.</p>
        <p>Se te ha asignado una auditoría en la plataforma <strong>Indusecc SGC</strong>.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #D4AF37;">
          <p><strong>Título:</strong> ${audit.title}</p>
          <p><strong>Fecha Programada:</strong> ${auditDate}</p>
          <p><strong>Descripción:</strong> ${audit.description || 'Sin descripción adicional'}</p>
        </div>
        <p>Por favor, revisa los detalles en tu panel de control.</p>
        <hr />
        <p style="font-size: 0.7em; color: #999;">Indusecc SGC - Sistema de Gestión de Calidad</p>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: `${subject}: ${audit.title}`,
      message: `Hola ${user.name}, se te ha asignado la auditoría "${audit.title}" para el día ${auditDate}.`,
      html
    });
  } catch (err) {
    logger.error('Error al enviar correo de notificación de auditoría:', err);
  }
};

const canAccessAudit = (user, audit) => {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  if (user.role === 'CONSULTOR') return audit.created_by === user.id || audit.assigned_to === user.id;
  if (user.role === 'COLABORADOR') return audit.assigned_to === user.id;
  return false;
};

const createAudit = async (req, res) => {
  try {
    const { title, description, date, assignedTo } = req.body;
    const createdBy = req.user.id;

    const { data: audit, error } = await supabaseAdmin
      .from('audits')
      .insert({ title, description, date, assigned_to: assignedTo || null, created_by: createdBy })
      .select('*')
      .single();

    if (error) throw error;

    await notifyAssignment(audit.assigned_to, audit, 'Nueva Auditoría Asignada', 'Nueva Auditoría Asignada');

    logger.info(`Auditoría creada: ${title} por ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Auditoría creada exitosamente',
      data: { audit: toApiAudit(audit) }
    });
  } catch (error) {
    logger.error('Error al crear auditoría:', error);
    res.status(500).json({ success: false, message: 'Error al crear auditoría', code: 'CREATE_AUDIT_ERROR' });
  }
};

const getAudits = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('audits')
      .select(SELECT_WITH_JOINS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.query.status) query = query.eq('status', STATUS_TO_DB[req.query.status] || req.query.status);
    if (req.query.assignedTo) query = query.eq('assigned_to', req.query.assignedTo);
    if (req.query.search) query = query.or(`title.ilike.%${req.query.search}%,description.ilike.%${req.query.search}%`);

    if (req.user.role === 'COLABORADOR') query = query.eq('assigned_to', req.user.id);

    const { data: audits, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      message: 'Auditorías obtenidas exitosamente',
      data: {
        audits: audits.map(toApiAudit),
        pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) }
      }
    });
  } catch (error) {
    logger.error('Error al obtener auditorías:', error);
    res.status(500).json({ success: false, message: 'Error al obtener auditorías', code: 'GET_AUDITS_ERROR' });
  }
};

const getAuditById = async (req, res) => {
  try {
    const { data: audit, error } = await supabaseAdmin
      .from('audits')
      .select(SELECT_WITH_JOINS)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!audit) {
      return res.status(404).json({ success: false, message: 'Auditoría no encontrada', code: 'AUDIT_NOT_FOUND' });
    }

    if (!canAccessAudit(req.user, audit)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para ver esta auditoría', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    res.json({ success: true, message: 'Auditoría obtenida exitosamente', data: { audit: toApiAudit(audit) } });
  } catch (error) {
    logger.error('Error al obtener auditoría:', error);
    res.status(500).json({ success: false, message: 'Error al obtener auditoría', code: 'GET_AUDIT_ERROR' });
  }
};

const updateAudit = async (req, res) => {
  try {
    const { title, description, date, assignedTo } = req.body;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('audits').select('created_by').eq('id', req.params.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Auditoría no encontrada', code: 'AUDIT_NOT_FOUND' });
    }
    if (req.user.role === 'CONSULTOR' && existing.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para actualizar esta auditoría', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) updateData.date = date;
    if (assignedTo !== undefined) updateData.assigned_to = assignedTo || null;

    const { data: audit, error } = await supabaseAdmin
      .from('audits')
      .update(updateData)
      .eq('id', req.params.id)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) throw error;

    logger.info(`Auditoría actualizada: ${audit.title} por ${req.user.email}`);

    res.json({ success: true, message: 'Auditoría actualizada exitosamente', data: { audit: toApiAudit(audit) } });
  } catch (error) {
    logger.error('Error al actualizar auditoría:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar auditoría', code: 'UPDATE_AUDIT_ERROR' });
  }
};

const deleteAudit = async (req, res) => {
  try {
    const { data: audit, error: fetchError } = await supabaseAdmin
      .from('audits').select('id, title, created_by').eq('id', req.params.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!audit) {
      return res.status(404).json({ success: false, message: 'Auditoría no encontrada', code: 'AUDIT_NOT_FOUND' });
    }
    if (req.user.role === 'CONSULTOR' && audit.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para eliminar esta auditoría', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    const { error } = await supabaseAdmin.from('audits').delete().eq('id', req.params.id);
    if (error) throw error;

    logger.info(`Auditoría eliminada: ${audit.title} por ${req.user.email}`);

    res.json({ success: true, message: 'Auditoría eliminada exitosamente', data: { deletedAudit: { id: audit.id, title: audit.title } } });
  } catch (error) {
    logger.error('Error al eliminar auditoría:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar auditoría', code: 'DELETE_AUDIT_ERROR' });
  }
};

const updateAuditStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Estado inválido', code: 'INVALID_STATUS' });
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('audits').select('created_by, assigned_to').eq('id', req.params.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Auditoría no encontrada', code: 'AUDIT_NOT_FOUND' });
    }
    if (!canAccessAudit(req.user, existing)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para cambiar el estado de esta auditoría', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    const { data: audit, error } = await supabaseAdmin
      .from('audits')
      .update({ status: STATUS_TO_DB[status] })
      .eq('id', req.params.id)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) throw error;

    logger.info(`Estado de auditoría cambiado: ${audit.title} -> ${status} por ${req.user.email}`);

    res.json({ success: true, message: 'Estado actualizado exitosamente', data: { audit: toApiAudit(audit) } });
  } catch (error) {
    logger.error('Error al cambiar estado de auditoría:', error);
    res.status(500).json({ success: false, message: 'Error al cambiar estado de auditoría', code: 'UPDATE_AUDIT_STATUS_ERROR' });
  }
};

const assignAudit = async (req, res) => {
  try {
    const { assignedTo } = req.body;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('audits').select('created_by').eq('id', req.params.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Auditoría no encontrada', code: 'AUDIT_NOT_FOUND' });
    }
    if (req.user.role === 'CONSULTOR' && existing.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para asignar esta auditoría', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    const { data: audit, error } = await supabaseAdmin
      .from('audits')
      .update({ assigned_to: assignedTo || null })
      .eq('id', req.params.id)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) throw error;

    await notifyAssignment(audit.assigned_to, audit, 'Auditoría Asignada', 'Auditoría Asignada');

    logger.info(`Auditoría asignada: ${audit.title} -> ${audit.assigned_to_profile?.name || 'Sin asignar'} por ${req.user.email}`);

    res.json({ success: true, message: 'Auditoría asignada exitosamente', data: { audit: toApiAudit(audit) } });
  } catch (error) {
    logger.error('Error al asignar auditoría:', error);
    res.status(500).json({ success: false, message: 'Error al asignar auditoría', code: 'ASSIGN_AUDIT_ERROR' });
  }
};

const getAuditStats = async (req, res) => {
  try {
    const counts = {};
    for (const [label, dbValue] of Object.entries(STATUS_TO_DB)) {
      const { count } = await supabaseAdmin.from('audits').select('id', { count: 'exact', head: true }).eq('status', dbValue);
      counts[label] = count || 0;
    }

    const { count: totalAudits } = await supabaseAdmin.from('audits').select('id', { count: 'exact', head: true });
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentAudits } = await supabaseAdmin.from('audits').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo);

    res.json({
      success: true,
      message: 'Estadísticas de auditorías obtenidas exitosamente',
      data: {
        totalAudits: totalAudits || 0,
        completedAudits: counts['Completada'],
        inProgressAudits: counts['En Progreso'],
        pendingAudits: counts['Pendiente'],
        recentAudits: recentAudits || 0,
        byStatus: Object.entries(counts).map(([label, count]) => ({ _id: label, count }))
      }
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas de auditorías:', error);
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas', code: 'GET_AUDIT_STATS_ERROR' });
  }
};

module.exports = {
  createAudit,
  getAudits,
  getAuditById,
  updateAudit,
  deleteAudit,
  updateAuditStatus,
  assignAudit,
  getAuditStats,
};

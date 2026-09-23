const { supabaseAdmin } = require('../config/supabaseClient');
const logger = require('../utils/logger');
const { notify } = require('../services/notificationService');

const toApiAction = (row) => ({
  id: row.id,
  _id: row.id,
  title: row.title,
  description: row.description,
  area: row.area,
  assignedTo: row.assigned_to_profile
    ? { _id: row.assigned_to_profile.id, id: row.assigned_to_profile.id, name: row.assigned_to_profile.name }
    : row.assigned_to,
  dueDate: row.due_date,
  priority: row.priority,
  status: ({ iniciada: 'Iniciada', en_proceso: 'En Proceso', cerrada: 'Cerrada' })[row.status] || row.status,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const STATUS_TO_DB = { 'Iniciada': 'iniciada', 'En Proceso': 'en_proceso', 'Cerrada': 'cerrada' };
const PRIORITIES = ['low', 'medium', 'high'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const isAdmin = (user) => ADMIN_ROLES.includes(user.role);

const notifyAssignee = async (assignedToId, action, heading, actor) => {
  if (!assignedToId || assignedToId === actor?.id) return;
  const due = action.due_date ? new Date(action.due_date).toLocaleDateString('es-MX') : 'sin fecha';
  await notify({
    userIds: [assignedToId],
    type: 'tarea_asignada',
    severity: action.priority === 'high' ? 'warning' : 'info',
    title: `${heading}: ${action.title}`,
    message: `Área: ${action.area || 'General'} · Prioridad: ${action.priority || 'medium'} · Vence: ${due}`,
    linkKey: 'tasks',
    entityType: 'action',
    entityId: action.id,
    createdBy: actor?.id || null,
    dedupe: true,
  });
};

const getActions = async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('actions')
      .select('*, assigned_to_profile:profiles!actions_assigned_to_fkey(id, name)')
      .order('created_at', { ascending: false });

    if (req.user.role === 'COLABORADOR') query = query.eq('assigned_to', req.user.id);

    const { data: actions, error } = await query;

    if (error) throw error;

    res.json({ success: true, count: actions.length, data: { actions: actions.map(toApiAction) } });
  } catch (error) {
    logger.error('Error al obtener acciones de mejora continuas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener acciones' });
  }
};

const createAction = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Solo un administrador puede crear acciones', code: 'FORBIDDEN_ACTION' });
    }

    const { title, description, area, assignedTo, dueDate, priority, status } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'El título es obligatorio', code: 'MISSING_TITLE' });
    }
    if (priority && !PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, message: 'Prioridad inválida', code: 'INVALID_PRIORITY' });
    }
    if (status && !STATUS_TO_DB[status]) {
      return res.status(400).json({ success: false, message: 'Estado inválido', code: 'INVALID_STATUS' });
    }

    const { data: action, error } = await supabaseAdmin
      .from('actions')
      .insert({
        title: String(title).trim(),
        description,
        area,
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
        priority: priority || 'medium',
        status: STATUS_TO_DB[status] || 'iniciada',
        created_by: req.user.id
      })
      .select('*')
      .single();

    if (error) throw error;

    await notifyAssignee(action.assigned_to, action, 'Nueva tarea asignada', req.user);

    logger.info(`Acción de mejora continua creada: ${action.title}`);
    res.status(201).json({ success: true, data: toApiAction(action) });
  } catch (error) {
    logger.error('Error al crear acción de mejora continua:', error);
    res.status(500).json({ success: false, message: 'Error al crear acción' });
  }
};

const updateAction = async (req, res) => {
  try {
    const { title, description, area, assignedTo, dueDate, priority, status } = req.body;

    if (!isAdmin(req.user)) {
      const { data: current, error: currentError } = await supabaseAdmin
        .from('actions').select('assigned_to').eq('id', req.params.id).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return res.status(404).json({ success: false, message: 'Acción no encontrada' });

      const onlyStatus = [title, description, area, assignedTo, dueDate, priority].every(v => v === undefined);
      if (current.assigned_to !== req.user.id || !onlyStatus || req.user.role === 'CONSULTOR') {
        return res.status(403).json({ success: false, message: 'Solo puedes cambiar el estado de tus propias tareas', code: 'FORBIDDEN_ACTION' });
      }
    }
    if (priority !== undefined && !PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, message: 'Prioridad inválida', code: 'INVALID_PRIORITY' });
    }
    if (status !== undefined && !STATUS_TO_DB[status]) {
      return res.status(400).json({ success: false, message: 'Estado inválido', code: 'INVALID_STATUS' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (area !== undefined) updateData.area = area;
    if (assignedTo !== undefined) updateData.assigned_to = assignedTo || null;
    if (dueDate !== undefined) updateData.due_date = dueDate || null;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) updateData.status = STATUS_TO_DB[status] || status;

    const { data: action, error } = await supabaseAdmin
      .from('actions')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!action) {
      return res.status(404).json({ success: false, message: 'Acción no encontrada' });
    }

    if (assignedTo) {
      await notifyAssignee(action.assigned_to, action, 'Tarea actualizada', req.user);
    }

    res.json({ success: true, data: toApiAction(action) });
  } catch (error) {
    logger.error('Error al actualizar acción:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar acción' });
  }
};

const deleteAction = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Solo un administrador puede eliminar acciones', code: 'FORBIDDEN_ACTION' });
    }
    const { error } = await supabaseAdmin.from('actions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Acción eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar acción' });
  }
};

module.exports = { getActions, createAction, updateAction, deleteAction };

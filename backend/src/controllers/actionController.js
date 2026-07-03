const { supabaseAdmin } = require('../config/supabaseClient');
const logger = require('../utils/logger');
const sendEmail = require('../utils/email');

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

const notifyAssignee = async (assignedToId, action, subjectPrefix, heading) => {
  if (!assignedToId) return;
  try {
    const { data: user } = await supabaseAdmin
      .from('profiles')
      .select('name, email')
      .eq('id', assignedToId)
      .maybeSingle();

    if (!user?.email) return;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #1B6B3A; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">${heading}</h2>
        <p>Hola, <strong>${user.name}</strong>.</p>
        <p>Se te asignó una Acción de Mejora en <strong>Indusecc SGC</strong>.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #1B6B3A;">
          <p><strong>Tarea:</strong> ${action.title}</p>
          <p><strong>Área:</strong> ${action.area || 'General'}</p>
          <p><strong>Prioridad:</strong> ${action.priority || 'Normal'}</p>
          <p><strong>Vencimiento:</strong> ${action.due_date ? new Date(action.due_date).toLocaleDateString() : 'No definida'}</p>
        </div>
        <p>Por favor, revisa la sección "Mis Tareas" en la plataforma para más detalles.</p>
        <hr />
        <p style="font-size: 0.7em; color: #999;">Indusecc SGC - Sistema de Gestión de Calidad</p>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: `${subjectPrefix}: ${action.title}`,
      message: `Hola ${user.name}, tienes una tarea: ${action.title}.`,
      html
    });
  } catch (err) {
    logger.error('Error al enviar correo de notificación de tarea:', err);
  }
};

const getActions = async (req, res) => {
  try {
    const { data: actions, error } = await supabaseAdmin
      .from('actions')
      .select('*, assigned_to_profile:profiles!actions_assigned_to_fkey(id, name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, count: actions.length, data: { actions: actions.map(toApiAction) } });
  } catch (error) {
    logger.error('Error al obtener acciones de mejora continuas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener acciones' });
  }
};

const createAction = async (req, res) => {
  try {
    const { title, description, area, assignedTo, dueDate, priority, status } = req.body;

    const { data: action, error } = await supabaseAdmin
      .from('actions')
      .insert({
        title,
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

    await notifyAssignee(action.assigned_to, action, '📋 Nueva Tarea', 'Nueva Tarea Asignada');

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
      await notifyAssignee(action.assigned_to, action, '🔄 Tarea Actualizada', 'Tarea Actualizada / Asignada');
    }

    res.json({ success: true, data: toApiAction(action) });
  } catch (error) {
    logger.error('Error al actualizar acción:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar acción' });
  }
};

const deleteAction = async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('actions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Acción eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar acción' });
  }
};

module.exports = { getActions, createAction, updateAction, deleteAction };

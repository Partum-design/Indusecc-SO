const { supabaseAdmin } = require('../config/supabaseClient');
const logger = require('../utils/logger');

// El enum calendar_type de la base solo acepta: auditoria, capacitacion, reunion, otro.
// El frontend (CalendarioAdmin.jsx) también ofrece "Vencimiento" y "Revisión", que
// nunca existieron en el enum original de Mongoose tampoco — se guardan como "otro"
// para no romper la creación de eventos, y se conserva el título original para
// que el usuario siga viendo el texto que escribió.
const TYPE_TO_DB = {
  'Auditoría': 'auditoria',
  'Capacitación': 'capacitacion',
  'Reunión': 'reunion',
  'Otro': 'otro',
  'Vencimiento': 'otro',
  'Revisión': 'otro',
};
const TYPE_TO_API = {
  auditoria: 'Auditoría',
  capacitacion: 'Capacitación',
  reunion: 'Reunión',
  otro: 'Otro',
};

const toApiCalendar = (row) => ({
  id: row.id,
  _id: row.id,
  title: row.title,
  description: row.description,
  date: row.date,
  type: TYPE_TO_API[row.type] || row.type,
  assignedTo: row.assigned_to_profile
    ? { _id: row.assigned_to_profile.id, id: row.assigned_to_profile.id, name: row.assigned_to_profile.name, email: row.assigned_to_profile.email }
    : row.assigned_to,
  createdBy: row.created_by_profile
    ? { _id: row.created_by_profile.id, id: row.created_by_profile.id, name: row.created_by_profile.name, email: row.created_by_profile.email }
    : row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const SELECT_WITH_PROFILES = '*, assigned_to_profile:profiles!calendar_events_assigned_to_fkey(id, name, email), created_by_profile:profiles!calendar_events_created_by_fkey(id, name, email)';

// Crear evento de calendario
const createCalendar = async (req, res) => {
  try {
    const { title, description, date, type, assignedTo } = req.body;
    const createdBy = req.user.id;

    const { data: calendar, error } = await supabaseAdmin
      .from('calendar_events')
      .insert({
        title,
        description,
        date,
        type: TYPE_TO_DB[type] || 'otro',
        assigned_to: assignedTo || null,
        created_by: createdBy
      })
      .select('*')
      .single();

    if (error) throw error;

    logger.info(`Evento de calendario creado: ${title} por ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Evento de calendario creado exitosamente',
      data: { calendar: toApiCalendar(calendar) }
    });
  } catch (error) {
    logger.error('Error al crear evento de calendario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear evento de calendario',
      code: 'CREATE_CALENDAR_ERROR'
    });
  }
};

// Obtener eventos de calendario con paginación y filtros
const getCalendars = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('calendar_events')
      .select(SELECT_WITH_PROFILES, { count: 'exact' })
      .order('date', { ascending: true })
      .range(from, to);

    if (req.query.type) query = query.eq('type', TYPE_TO_DB[req.query.type] || req.query.type);
    if (req.query.assignedTo) query = query.eq('assigned_to', req.query.assignedTo);
    if (req.query.search) {
      query = query.or(`title.ilike.%${req.query.search}%,description.ilike.%${req.query.search}%`);
    }
    if (req.query.startDate) query = query.gte('date', req.query.startDate);
    if (req.query.endDate) query = query.lte('date', req.query.endDate);

    // Filtros de permisos (igual que antes: admin/super_admin ven todo)
    if (req.user.role === 'CONSULTOR') {
      query = query.or(`created_by.eq.${req.user.id},assigned_to.eq.${req.user.id}`);
    } else if (req.user.role === 'COLABORADOR') {
      query = query.eq('assigned_to', req.user.id);
    }

    const { data: calendars, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      message: 'Eventos de calendario obtenidos exitosamente',
      data: {
        calendars: calendars.map(toApiCalendar),
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error al obtener eventos de calendario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener eventos de calendario',
      code: 'GET_CALENDARS_ERROR'
    });
  }
};

// Obtener evento de calendario por ID
const getCalendarById = async (req, res) => {
  try {
    const { data: calendar, error } = await supabaseAdmin
      .from('calendar_events')
      .select(SELECT_WITH_PROFILES)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!calendar) {
      return res.status(404).json({
        success: false,
        message: 'Evento de calendario no encontrado',
        code: 'CALENDAR_NOT_FOUND'
      });
    }

    if (req.user.role === 'CONSULTOR' &&
        calendar.created_by !== req.user.id &&
        calendar.assigned_to !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver este evento',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    if (req.user.role === 'COLABORADOR' && calendar.assigned_to !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver este evento',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    res.json({
      success: true,
      message: 'Evento de calendario obtenido exitosamente',
      data: { calendar: toApiCalendar(calendar) }
    });
  } catch (error) {
    logger.error('Error al obtener evento de calendario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener evento de calendario',
      code: 'GET_CALENDAR_ERROR'
    });
  }
};

// Actualizar evento de calendario
const updateCalendar = async (req, res) => {
  try {
    const { title, description, date, type, assignedTo } = req.body;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('calendar_events')
      .select('created_by')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Evento de calendario no encontrado',
        code: 'CALENDAR_NOT_FOUND'
      });
    }

    if (req.user.role === 'CONSULTOR' && existing.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para actualizar este evento',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) updateData.date = date;
    if (type !== undefined) updateData.type = TYPE_TO_DB[type] || type;
    if (assignedTo !== undefined) updateData.assigned_to = assignedTo || null;

    const { data: calendar, error: updateError } = await supabaseAdmin
      .from('calendar_events')
      .update(updateData)
      .eq('id', req.params.id)
      .select(SELECT_WITH_PROFILES)
      .single();

    if (updateError) throw updateError;

    logger.info(`Evento de calendario actualizado: ${calendar.title} por ${req.user.email}`);

    res.json({
      success: true,
      message: 'Evento de calendario actualizado exitosamente',
      data: { calendar: toApiCalendar(calendar) }
    });
  } catch (error) {
    logger.error('Error al actualizar evento de calendario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar evento de calendario',
      code: 'UPDATE_CALENDAR_ERROR'
    });
  }
};

// Eliminar evento de calendario
const deleteCalendar = async (req, res) => {
  try {
    const { data: calendar, error: fetchError } = await supabaseAdmin
      .from('calendar_events')
      .select('id, title, created_by')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!calendar) {
      return res.status(404).json({
        success: false,
        message: 'Evento de calendario no encontrado',
        code: 'CALENDAR_NOT_FOUND'
      });
    }

    if (req.user.role === 'CONSULTOR' && calendar.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este evento',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const { error: deleteError } = await supabaseAdmin.from('calendar_events').delete().eq('id', req.params.id);
    if (deleteError) throw deleteError;

    logger.info(`Evento de calendario eliminado: ${calendar.title} por ${req.user.email}`);

    res.json({
      success: true,
      message: 'Evento de calendario eliminado exitosamente',
      data: { deletedCalendar: { id: calendar.id, title: calendar.title } }
    });
  } catch (error) {
    logger.error('Error al eliminar evento de calendario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar evento de calendario',
      code: 'DELETE_CALENDAR_ERROR'
    });
  }
};

// Asignar evento de calendario
const assignCalendar = async (req, res) => {
  try {
    const { assignedTo } = req.body;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('calendar_events')
      .select('id, title, created_by')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Evento de calendario no encontrado',
        code: 'CALENDAR_NOT_FOUND'
      });
    }

    if (req.user.role === 'CONSULTOR' && existing.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para asignar este evento',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const { data: calendar, error: updateError } = await supabaseAdmin
      .from('calendar_events')
      .update({ assigned_to: assignedTo || null })
      .eq('id', req.params.id)
      .select(SELECT_WITH_PROFILES)
      .single();

    if (updateError) throw updateError;

    logger.info(`Evento de calendario asignado: ${calendar.title} -> ${calendar.assigned_to_profile?.name || 'Sin asignar'} por ${req.user.email}`);

    res.json({
      success: true,
      message: 'Evento de calendario asignado exitosamente',
      data: { calendar: toApiCalendar(calendar) }
    });
  } catch (error) {
    logger.error('Error al asignar evento de calendario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar evento de calendario',
      code: 'ASSIGN_CALENDAR_ERROR'
    });
  }
};

// Estadísticas de calendario
const getCalendarStats = async (req, res) => {
  try {
    const { data: allEvents, error } = await supabaseAdmin
      .from('calendar_events')
      .select('type, date');

    if (error) throw error;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString().slice(0, 10);

    const byTypeMap = {};
    allEvents.forEach(e => {
      byTypeMap[e.type] = (byTypeMap[e.type] || 0) + 1;
    });
    const byType = Object.entries(byTypeMap)
      .map(([type, count]) => ({ _id: TYPE_TO_API[type] || type, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      message: 'Estadísticas de calendario obtenidas exitosamente',
      data: {
        totalEvents: allEvents.length,
        upcomingEvents: allEvents.filter(e => e.date >= todayStr).length,
        pastEvents: allEvents.filter(e => e.date < todayStr).length,
        thisMonthEvents: allEvents.filter(e => e.date >= thisMonthStart && e.date < nextMonthStart).length,
        nextMonthEvents: allEvents.filter(e => e.date >= nextMonthStart && e.date < nextMonthEnd).length,
        byType
      }
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas de calendario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      code: 'GET_CALENDAR_STATS_ERROR'
    });
  }
};

module.exports = {
  createCalendar,
  getCalendars,
  getCalendarById,
  updateCalendar,
  deleteCalendar,
  assignCalendar,
  getCalendarStats,
};

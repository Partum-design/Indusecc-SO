const { supabaseAdmin } = require('../config/supabaseClient');
const logger = require('../utils/logger');

const createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const createdBy = req.user.id;

    const { data: existingRole } = await supabaseAdmin
      .from('custom_roles')
      .select('id')
      .eq('name', name)
      .maybeSingle();

    if (existingRole) {
      return res.status(409).json({
        success: false,
        message: 'El rol ya existe',
        code: 'ROLE_ALREADY_EXISTS'
      });
    }

    const { data: role, error } = await supabaseAdmin
      .from('custom_roles')
      .insert({ name, description, permissions: permissions || [], created_by: createdBy })
      .select('id, name, description, permissions, created_at')
      .single();

    if (error) throw error;

    logger.info(`Rol creado: ${name} por usuario ${createdBy}`);

    res.status(201).json({
      success: true,
      message: 'Rol creado exitosamente',
      data: { role }
    });
  } catch (error) {
    logger.error('Error al crear rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear rol',
      code: 'CREATE_ROLE_ERROR'
    });
  }
};

const getRoles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: roles, count, error } = await supabaseAdmin
      .from('custom_roles')
      .select('id, name, description, permissions, created_at, created_by:profiles(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Roles obtenidos exitosamente',
      data: {
        roles,
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error al obtener roles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener roles',
      code: 'GET_ROLES_ERROR'
    });
  }
};

const getRoleById = async (req, res) => {
  try {
    const { data: role, error } = await supabaseAdmin
      .from('custom_roles')
      .select('id, name, description, permissions, created_at, created_by:profiles(name, email)')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
        code: 'ROLE_NOT_FOUND'
      });
    }

    res.json({ success: true, data: { role } });
  } catch (error) {
    logger.error('Error al obtener rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener rol',
      code: 'GET_ROLE_ERROR'
    });
  }
};

const updateRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    const { data: existingRole } = await supabaseAdmin
      .from('custom_roles')
      .select('id')
      .eq('name', name)
      .neq('id', req.params.id)
      .maybeSingle();

    if (existingRole) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe otro rol con ese nombre',
        code: 'ROLE_NAME_ALREADY_EXISTS'
      });
    }

    const { data: role, error } = await supabaseAdmin
      .from('custom_roles')
      .update({ name, description, permissions: permissions || [] })
      .eq('id', req.params.id)
      .select('id, name, description, permissions, updated_at')
      .maybeSingle();

    if (error) throw error;
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
        code: 'ROLE_NOT_FOUND'
      });
    }

    logger.info(`Rol actualizado: ${role.name}`);

    res.json({
      success: true,
      message: 'Rol actualizado exitosamente',
      data: { role }
    });
  } catch (error) {
    logger.error('Error al actualizar rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar rol',
      code: 'UPDATE_ROLE_ERROR'
    });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { data: role, error } = await supabaseAdmin
      .from('custom_roles')
      .delete()
      .eq('id', req.params.id)
      .select('id, name')
      .maybeSingle();

    if (error) throw error;
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
        code: 'ROLE_NOT_FOUND'
      });
    }

    logger.info(`Rol eliminado: ${role.name}`);

    res.json({ success: true, message: 'Rol eliminado exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar rol',
      code: 'DELETE_ROLE_ERROR'
    });
  }
};

module.exports = {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole
};

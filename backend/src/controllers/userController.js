const { supabaseAdmin, supabaseAuth } = require('../config/supabaseClient');
const logger = require('../utils/logger');

const MANAGEABLE_BY_ADMIN = ['COLABORADOR', 'CONSULTOR'];

const toApiUser = (profile) => ({
  id: profile.id,
  _id: profile.id,
  name: profile.name,
  email: profile.email,
  role: profile.role?.toUpperCase(),
  active: profile.active,
  createdAt: profile.created_at,
  updatedAt: profile.updated_at,
});

// Crear usuario directamente (sin pasar por el flujo de solicitud/aprobación)
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, active } = req.body;

    if (req.user.role === 'ADMIN' && !MANAGEABLE_BY_ADMIN.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para crear este tipo de usuario',
        code: 'FORBIDDEN_ROLE_CREATE'
      });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (createError) {
      if (/already registered|exists/i.test(createError.message || '')) {
        return res.status(409).json({
          success: false,
          message: 'El email ya está registrado',
          code: 'DUPLICATE_EMAIL'
        });
      }
      throw createError;
    }

    // El trigger de alta ya creó el perfil (colaborador, inactivo); lo ajustamos
    // al rol y estado solicitados por quien está creando la cuenta.
    const { data: profile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: role.toLowerCase(), active: active !== false })
      .eq('id', created.user.id)
      .select('id, name, email, role, active, created_at, updated_at')
      .single();

    if (updateError) throw updateError;

    logger.info(`Usuario creado: ${email} por ${req.user?.email || 'sistema'}`);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: { user: toApiUser(profile) }
    });
  } catch (error) {
    logger.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      code: 'CREATE_USER_ERROR'
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('profiles')
      .select('id, name, email, role, active, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.query.role) query = query.eq('role', req.query.role.toLowerCase());
    if (req.query.active !== undefined) query = query.eq('active', req.query.active === 'true');
    if (req.query.search) {
      query = query.or(`name.ilike.%${req.query.search}%,email.ilike.%${req.query.search}%`);
    }

    const { data: profiles, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      message: 'Usuarios obtenidos exitosamente',
      data: {
        users: profiles.map(toApiUser),
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      code: 'GET_USERS_ERROR'
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, role, active, created_at, updated_at')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Usuario obtenido exitosamente',
      data: { user: toApiUser(profile) }
    });
  } catch (error) {
    logger.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario',
      code: 'GET_USER_ERROR'
    });
  }
};

// Elimina la cuenta de Auth (borra en cascada el perfil por FK) — minimización
// de datos: no dejamos cuentas "fantasma" ni credenciales huérfanas.
const deleteUser = async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', req.params.id)
      .maybeSingle();

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    if (error) throw error;

    logger.info(`Usuario eliminado: ${profile.email} por ${req.user?.email || 'sistema'}`);

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
      data: { deletedUser: { id: profile.id, email: profile.email } }
    });
  } catch (error) {
    logger.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario',
      code: 'DELETE_USER_ERROR'
    });
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, active')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    if (req.user.role === 'ADMIN' && !MANAGEABLE_BY_ADMIN.includes(profile.role.toUpperCase())) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para cambiar el estado de este usuario',
        code: 'FORBIDDEN_ROLE_UPDATE'
      });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ active: !profile.active })
      .eq('id', profile.id)
      .select('id, email, active')
      .single();

    if (updateError) throw updateError;

    logger.info(`Estado de usuario cambiado: ${updated.email} -> ${updated.active ? 'activo' : 'inactivo'} por ${req.user?.email || 'sistema'}`);

    res.json({
      success: true,
      message: `Usuario ${updated.active ? 'activado' : 'desactivado'} exitosamente`,
      data: { user: { id: updated.id, email: updated.email, active: updated.active } }
    });
  } catch (error) {
    logger.error('Error al cambiar estado de usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado de usuario',
      code: 'TOGGLE_USER_STATUS_ERROR'
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, email, role, active } = req.body;

    const { data: userToUpdate, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!userToUpdate) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    if (req.user.role === 'ADMIN') {
      if (!MANAGEABLE_BY_ADMIN.includes(userToUpdate.role.toUpperCase())) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para actualizar este usuario',
          code: 'FORBIDDEN_ROLE_UPDATE'
        });
      }
      if (role !== undefined && !MANAGEABLE_BY_ADMIN.includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para asignar este tipo de rol',
          code: 'FORBIDDEN_ROLE_UPDATE'
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role.toLowerCase();
    if (active !== undefined) updateData.active = active;

    if (email !== undefined) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, { email });
      if (authUpdateError) throw authUpdateError;
    }

    const { data: profile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', req.params.id)
      .select('id, name, email, role, active, created_at, updated_at')
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: { user: toApiUser(profile) }
    });
  } catch (error) {
    logger.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      code: 'UPDATE_USER_ERROR'
    });
  }
};

const getUserStats = async (req, res) => {
  try {
    const { count: totalUsers } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true });
    const { count: activeUsers } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('active', true);
    const { count: inactiveUsers } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('active', false);

    const roles = ['super_admin', 'admin', 'colaborador', 'consultor'];
    const roleStats = {};
    for (const role of roles) {
      const { count } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', role);
      roleStats[role.toUpperCase()] = count || 0;
    }

    res.json({
      success: true,
      message: 'Estadísticas de usuarios obtenidas exitosamente',
      data: {
        total: totalUsers || 0,
        active: activeUsers || 0,
        inactive: inactiveUsers || 0,
        byRole: roleStats
      }
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas de usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de usuarios',
      code: 'GET_USER_STATS_ERROR'
    });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar la contraseña actual',
          code: 'CURRENT_PASSWORD_REQUIRED'
        });
      }

      const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
        email: req.user.email,
        password: currentPassword
      });

      if (signInError) {
        return res.status(401).json({
          success: false,
          message: 'Contraseña actual incorrecta',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
      if (passwordError) throw passwordError;
    }

    const updateData = {};
    if (name) updateData.name = name;

    let profile;
    if (Object.keys(updateData).length > 0) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select('id, name, email, role, active, updated_at')
        .single();
      if (error) throw error;
      profile = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, role, active, updated_at')
        .eq('id', userId)
        .single();
      if (error) throw error;
      profile = data;
    }

    logger.info(`Perfil actualizado: ${profile.email}`);

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: { user: toApiUser(profile) }
    });
  } catch (error) {
    logger.error('Error al actualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil',
      code: 'UPDATE_PROFILE_ERROR'
    });
  }
};

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getUserStats,
  updateUserProfile,
};

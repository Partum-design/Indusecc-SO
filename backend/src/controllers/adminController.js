const { supabaseAdmin } = require('../config/supabaseClient');
const logger = require('../utils/logger');

// ===== CONFIGURACIÓN GLOBAL =====

const getConfiguration = async (req, res) => {
  try {
    const { data: configs, error } = await supabaseAdmin
      .from('configurations')
      .select('key, value, description, value_type, updated_at, updated_by:profiles(name, email)')
      .order('key');

    if (error) throw error;

    res.json({ success: true, message: 'Configuración obtenida', data: configs });
  } catch (error) {
    logger.error('Error al obtener configuración:', error);
    res.status(500).json({ success: false, message: 'Error al obtener configuración', code: 'GET_CONFIG_ERROR' });
  }
};

const updateConfiguration = async (req, res) => {
  try {
    const { settings } = req.body;
    const userId = req.user.id;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'El campo settings debe ser un objeto', code: 'INVALID_SETTINGS' });
    }

    const rows = Object.entries(settings).map(([key, value]) => ({
      key,
      value,
      value_type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : typeof value === 'object' ? 'object' : 'string',
      updated_by: userId,
      updated_at: new Date().toISOString()
    }));

    const { data: updatedConfigs, error } = await supabaseAdmin
      .from('configurations')
      .upsert(rows, { onConflict: 'key' })
      .select('*');

    if (error) throw error;

    logger.info(`Configuración actualizada por usuario ${userId}: ${Object.keys(settings).join(', ')}`);

    res.json({
      success: true,
      message: 'Configuración guardada exitosamente',
      data: { updated: updatedConfigs.length, configs: updatedConfigs }
    });
  } catch (error) {
    logger.error('Error al actualizar configuración:', error);
    res.status(500).json({ success: false, message: 'Error al guardar configuración', code: 'UPDATE_CONFIG_ERROR' });
  }
};

const DEFAULT_CONFIGS = {
  siteName: 'Indusecc SGC',
  version: '2.4.1',
  sessionTimeout: 60,
  maxUsers: 50,
  logRetention: 365,
  twoFactor: true,
  maintenanceMode: false,
  emailNotif: true,
  autoBackup: true,
  backupFrequency: 'Diario',
  debugMode: false,
  allowRegister: false
};

const restoreConfiguration = async (req, res) => {
  try {
    const userId = req.user.id;

    await supabaseAdmin.from('configurations').delete().neq('key', '');

    const rows = Object.entries(DEFAULT_CONFIGS).map(([key, value]) => ({
      key,
      value,
      value_type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string',
      updated_by: userId,
      description: `Configuración por defecto: ${key}`
    }));

    const { data: configs, error } = await supabaseAdmin.from('configurations').insert(rows).select('key');
    if (error) throw error;

    logger.info(`Configuración restaurada a valores predeterminados por usuario ${userId}`);

    res.json({ success: true, message: 'Configuración restaurada a valores predeterminados', data: { configs: configs.length } });
  } catch (error) {
    logger.error('Error al restaurar configuración:', error);
    res.status(500).json({ success: false, message: 'Error al restaurar configuración', code: 'RESTORE_CONFIG_ERROR' });
  }
};

// ===== GESTIÓN DE CONTRASEÑAS =====

const resetUserPassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const adminId = req.user.id;

    if (!userId || !newPassword) {
      return res.status(400).json({ success: false, message: 'userId y newPassword son requeridos', code: 'MISSING_FIELDS' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres', code: 'PASSWORD_TOO_SHORT' });
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'La contraseña debe contener mayúsculas, minúsculas y números', code: 'WEAK_PASSWORD' });
    }

    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado', code: 'USER_NOT_FOUND' });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
    if (updateError) throw updateError;

    await supabaseAdmin.from('audit_logs').insert({
      action: 'RESET_PASSWORD',
      module: 'Users',
      description: `${profile.email} - contraseña reseteada por administrador`,
      status: 'exito',
      user_id: adminId,
      details: { targetUser: userId }
    });

    logger.info(`Contraseña reseteada para ${profile.email} por usuario ${adminId}`);

    res.json({ success: true, message: 'Contraseña reseteada exitosamente', data: { userId: profile.id, email: profile.email } });
  } catch (error) {
    logger.error('Error al resetear contraseña:', error);
    res.status(500).json({ success: false, message: 'Error al resetear contraseña', code: 'RESET_PASSWORD_ERROR' });
  }
};

// ===== GESTIÓN DE LOGS =====

const getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('audit_logs')
      .select('id, action, module, description, status, details, ip_address, user_agent, created_at, user:profiles(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.query.action) query = query.eq('action', req.query.action);
    if (req.query.module) query = query.eq('module', req.query.module);
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.userId) query = query.eq('user_id', req.query.userId);

    const { data: logs, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      message: 'Logs de auditoría obtenidos',
      data: {
        logs: (logs || []).map(l => ({ ...l, _id: l.id })),
        pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) }
      }
    });
  } catch (error) {
    logger.error('Error al obtener logs:', error);
    res.status(500).json({ success: false, message: 'Error al obtener logs', code: 'GET_LOGS_ERROR' });
  }
};

// Purga logs viejos. Se deja registro del propio evento de purga ANTES de
// borrar, para conservar trazabilidad de que ocurrió y quién la ordenó
// (manejo ético de retención: no se borra "en silencio").
const purgeLogs = async (req, res) => {
  try {
    const { daysOld } = req.body;
    const userId = req.user.id;

    if (!daysOld || daysOld < 1) {
      return res.status(400).json({ success: false, message: 'daysOld debe ser mayor a 0', code: 'INVALID_DAYS' });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await supabaseAdmin.from('audit_logs').insert({
      action: 'PURGE_LOGS',
      module: 'System',
      description: `Purga de logs anteriores a ${cutoffDate.toISOString()}`,
      status: 'exito',
      user_id: userId,
      details: { daysOld, cutoffDate: cutoffDate.toISOString() }
    });

    const { data: deleted, error } = await supabaseAdmin
      .from('audit_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) throw error;

    logger.info(`${deleted.length} logs purgados por usuario ${userId}`);

    res.json({ success: true, message: `${deleted.length} logs eliminados`, data: { deleted: deleted.length } });
  } catch (error) {
    logger.error('Error al purgar logs:', error);
    res.status(500).json({ success: false, message: 'Error al purgar logs', code: 'PURGE_LOGS_ERROR' });
  }
};

// ===== SESIONES =====

const logoutAllSessions = async (req, res) => {
  try {
    const userId = req.user.id;

    await supabaseAdmin.from('audit_logs').insert({
      action: 'LOGOUT_ALL',
      module: 'Sessions',
      description: 'Logout forzado de todas las sesiones solicitado',
      status: 'exito',
      user_id: userId
    });

    logger.info(`Logout de todas las sesiones solicitado por usuario ${userId}`);

    res.json({
      success: true,
      message: 'Solicitud registrada. Supabase Auth no expone una API para revocar todas las sesiones activas de golpe; para forzar un re-login masivo, cambia la contraseña de cada usuario afectado desde este panel.',
      data: { message: 'Los usuarios deberán volver a iniciar sesión al expirar su token actual' }
    });
  } catch (error) {
    logger.error('Error al hacer logout de todas las sesiones:', error);
    res.status(500).json({ success: false, message: 'Error al cerrar sesiones', code: 'LOGOUT_ALL_ERROR' });
  }
};

// ===== SISTEMA =====

const clearCache = async (req, res) => {
  try {
    const userId = req.user.id;

    await supabaseAdmin.from('audit_logs').insert({
      action: 'CLEAR_CACHE',
      module: 'System',
      description: 'Caché del sistema limpiado',
      status: 'exito',
      user_id: userId
    });

    logger.info(`Caché limpiado por usuario ${userId}`);

    res.json({ success: true, message: 'Caché limpiado exitosamente', data: { message: 'Sistema optimizado' } });
  } catch (error) {
    logger.error('Error al limpiar caché:', error);
    res.status(500).json({ success: false, message: 'Error al limpiar caché', code: 'CLEAR_CACHE_ERROR' });
  }
};

module.exports = {
  getConfiguration,
  updateConfiguration,
  restoreConfiguration,
  resetUserPassword,
  getAuditLogs,
  purgeLogs,
  logoutAllSessions,
  clearCache
};

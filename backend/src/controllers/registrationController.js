const { supabaseAdmin } = require('../config/supabaseClient');
const logger = require('../utils/logger');

const ALLOWED_SELF_REQUEST_ROLES = ['COLABORADOR', 'CONSULTOR'];

// Crear solicitud de registro: el propio usuario define su contraseña.
// Un trigger en la base (handle_new_auth_user) crea automáticamente el perfil
// (inactivo) y la fila en registration_requests; aquí solo creamos la cuenta.
const requestRegistration = async (req, res) => {
  try {
    const { name, email, password, phone, department, requestedRole } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 8 caracteres',
        code: 'WEAK_PASSWORD'
      });
    }

    const role = ALLOWED_SELF_REQUEST_ROLES.includes(requestedRole) ? requestedRole : 'COLABORADOR';

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        phone,
        department,
        requested_role: role.toLowerCase()
      }
    });

    if (createError) {
      if (createError.status === 422 || /already registered|exists/i.test(createError.message || '')) {
        return res.status(409).json({
          success: false,
          message: 'El email ya está registrado',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }
      logger.error('Error al crear usuario de registro:', createError);
      return res.status(500).json({
        success: false,
        message: 'Error al procesar la solicitud',
        code: 'REGISTRATION_REQUEST_ERROR'
      });
    }

    logger.info(`Solicitud de registro creada: ${email}`);

    const { data: request } = await supabaseAdmin
      .from('registration_requests')
      .select('id, name, email, requested_role, status, created_at')
      .eq('user_id', created.user.id)
      .maybeSingle();

    res.status(201).json({
      success: true,
      message: 'Solicitud de registro enviada. Espera la aprobación del administrador.',
      data: {
        request: request ? {
          id: request.id,
          name: request.name,
          email: request.email,
          requestedRole: request.requested_role,
          status: request.status,
          createdAt: request.created_at
        } : null
      }
    });
  } catch (error) {
    logger.error('Error al crear solicitud de registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la solicitud',
      code: 'REGISTRATION_REQUEST_ERROR'
    });
  }
};

const getRegistrationRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('registration_requests')
      .select('id, name, email, requested_role, status, approval_notes, created_at, approved_at, rejected_at, approved_by:profiles!registration_requests_approved_by_fkey(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.search) {
      query = query.or(`name.ilike.%${req.query.search}%,email.ilike.%${req.query.search}%`);
    }

    const { data: requests, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      message: 'Solicitudes de registro obtenidas',
      data: {
        requests,
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error al obtener solicitudes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener solicitudes',
      code: 'GET_REQUESTS_ERROR'
    });
  }
};

const approveRegistration = async (req, res) => {
  try {
    const { requestId, approvalNotes } = req.body;
    const approver = req.user;

    const { data: request, error: requestError } = await supabaseAdmin
      .from('registration_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada',
        code: 'REQUEST_NOT_FOUND'
      });
    }

    if (request.status !== 'pendiente') {
      return res.status(400).json({
        success: false,
        message: 'Esta solicitud ya fue procesada',
        code: 'REQUEST_ALREADY_PROCESSED'
      });
    }

    if (!request.user_id) {
      return res.status(409).json({
        success: false,
        message: 'La cuenta asociada a esta solicitud ya no existe',
        code: 'ORPHAN_REQUEST'
      });
    }

    // Un ADMIN (no super_admin) solo puede aprobar colaborador/consultor.
    if (approver.role === 'ADMIN' && !['colaborador', 'consultor'].includes(request.requested_role)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para aprobar este tipo de rol',
        code: 'FORBIDDEN_ROLE_APPROVE'
      });
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ role: request.requested_role, active: true })
      .eq('id', request.user_id);

    if (profileError) throw profileError;

    const { error: updateError } = await supabaseAdmin
      .from('registration_requests')
      .update({
        status: 'aprobada',
        approval_notes: approvalNotes || '',
        approved_by: approver.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) throw updateError;

    logger.info(`Solicitud de registro aprobada: ${request.email} por ${approver.email}`);

    res.json({
      success: true,
      message: 'Solicitud aprobada. El usuario ya puede iniciar sesión con la contraseña que definió al registrarse.',
      data: {
        user: {
          id: request.user_id,
          name: request.name,
          email: request.email,
          role: request.requested_role.toUpperCase()
        },
        request: {
          id: request.id,
          status: 'aprobada',
          approvedAt: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    logger.error('Error al aprobar solicitud:', error);
    res.status(500).json({
      success: false,
      message: 'Error al aprobar solicitud',
      code: 'APPROVE_ERROR'
    });
  }
};

// Rechazar: además de marcar la solicitud, se elimina la cuenta de Auth creada
// (minimización de datos — no conservamos credenciales de alguien a quien se le
// negó el acceso). El registro de auditoría (registration_requests) se conserva.
const rejectRegistration = async (req, res) => {
  try {
    const { requestId, rejectionReason } = req.body;
    const approver = req.user;

    const { data: request, error: requestError } = await supabaseAdmin
      .from('registration_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada',
        code: 'REQUEST_NOT_FOUND'
      });
    }

    if (request.status !== 'pendiente') {
      return res.status(400).json({
        success: false,
        message: 'Esta solicitud ya fue procesada',
        code: 'REQUEST_ALREADY_PROCESSED'
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from('registration_requests')
      .update({
        status: 'rechazada',
        approval_notes: rejectionReason || '',
        approved_by: approver.id,
        rejected_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) throw updateError;

    if (request.user_id) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(request.user_id);
      if (deleteError) {
        logger.error('No se pudo eliminar la cuenta rechazada:', deleteError);
      }
    }

    logger.info(`Solicitud de registro rechazada: ${request.email} por ${approver.email}`);

    res.json({
      success: true,
      message: 'Solicitud rechazada',
      data: {
        request: {
          id: request.id,
          status: 'rechazada',
          rejectedAt: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    logger.error('Error al rechazar solicitud:', error);
    res.status(500).json({
      success: false,
      message: 'Error al rechazar solicitud',
      code: 'REJECT_ERROR'
    });
  }
};

module.exports = {
  requestRegistration,
  getRegistrationRequests,
  approveRegistration,
  rejectRegistration
};

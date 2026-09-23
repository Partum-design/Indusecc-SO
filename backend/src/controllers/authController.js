const { supabaseAdmin, supabaseAuth } = require('../config/supabaseClient')
const { FRONTEND_URL, DEMO_LOGIN_ENABLED } = require('../config/environment')
const { DEMO_ROLES, demoLogin: performDemoLogin } = require('../services/demoAccess')
const logger = require('../utils/logger')
const sendEmail = require('../utils/email')

const registerUser = async (_req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Este endpoint está deprecado. Use POST /api/registration/request',
    code: 'DEPRECATED_ENDPOINT',
    newEndpoint: 'POST /api/registration/request'
  });
}

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body

    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({ email, password })
    if (authError || !authData?.session) {
      return res.status(401).json({ message: 'Credenciales incorrectas' })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, role, active')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      return res.status(401).json({ message: 'Credenciales incorrectas' })
    }

    if (!profile.active) {
      return res.status(403).json({ message: 'Usuario desactivado' })
    }

    await supabaseAdmin
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', profile.id)

    res.json({
      message: 'Login exitoso',
      user: { id: profile.id, name: profile.name, email: profile.email, role: profile.role.toUpperCase() },
      token: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
    })
  } catch (error) {
    logger.error('Error en login:', error)
    res.status(500).json({ message: 'Error en el servidor' })
  }
}

// Indica al login si debe mostrar los botones de acceso rápido por rol.
const demoStatus = (_req, res) => {
  res.json({
    success: true,
    data: { enabled: DEMO_LOGIN_ENABLED, roles: DEMO_LOGIN_ENABLED ? Object.keys(DEMO_ROLES) : [] }
  })
}

// Inicio de sesión con un solo clic por rol. Devuelve exactamente lo mismo que /auth/login.
const demoLogin = async (req, res) => {
  if (!DEMO_LOGIN_ENABLED) {
    return res.status(403).json({ success: false, message: 'El acceso rápido por rol está desactivado', code: 'DEMO_LOGIN_DISABLED' })
  }

  const role = String(req.body?.role || '').toUpperCase()
  if (!DEMO_ROLES[role]) {
    return res.status(400).json({ success: false, message: 'Rol inválido', code: 'INVALID_ROLE' })
  }

  try {
    const session = await performDemoLogin(role)
    res.json({ message: 'Login exitoso', ...session })
  } catch (error) {
    logger.error('Error en acceso rápido por rol:', error)
    res.status(500).json({ message: 'No se pudo iniciar el acceso rápido. Intenta de nuevo.' })
  }
}

// Renueva la sesión sin volver a pedir contraseña (los tokens de acceso de Supabase duran 1 hora).
const refreshSession = async (req, res) => {
  const refreshToken = req.body?.refreshToken
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ success: false, message: 'refreshToken requerido', code: 'MISSING_REFRESH_TOKEN' })
  }

  try {
    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data?.session) {
      return res.status(401).json({ success: false, message: 'Sesión expirada, inicia sesión de nuevo', code: 'REFRESH_FAILED' })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, role, active')
      .eq('id', data.user.id)
      .maybeSingle()

    if (!profile?.active) {
      return res.status(403).json({ success: false, message: 'Usuario desactivado', code: 'USER_INACTIVE' })
    }

    res.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: { id: profile.id, name: profile.name, email: profile.email, role: profile.role.toUpperCase() },
    })
  } catch (error) {
    logger.error('Error al renovar sesión:', error)
    res.status(500).json({ success: false, message: 'No se pudo renovar la sesión', code: 'REFRESH_ERROR' })
  }
}

const uploadFile = async (req, res) => {
  try {
    const { file, filename } = req.body
    const userId = req.user.id

    if (!file || !filename) {
      return res.status(400).json({
        success: false,
        message: 'Archivo y nombre de archivo son requeridos',
        code: 'MISSING_FILE'
      })
    }

    const fileSizeBytes = Buffer.byteLength(file, 'utf8')
    const maxSize = 10 * 1024 * 1024
    if (fileSizeBytes > maxSize) {
      return res.status(413).json({
        success: false,
        message: 'Archivo demasiado grande (máximo 10MB)',
        code: 'FILE_TOO_LARGE'
      })
    }

    logger.info(`Archivo cargado: ${filename} por usuario ${userId}`)

    res.json({
      success: true,
      message: 'Archivo cargado exitosamente',
      data: {
        file: {
          filename,
          size: fileSizeBytes,
          uploadedBy: userId,
          uploadedAt: new Date()
        }
      }
    })
  } catch (error) {
    logger.error('Error al cargar archivo:', error)
    res.status(500).json({
      success: false,
      message: 'Error al cargar archivo',
      code: 'UPLOAD_ERROR'
    })
  }
}

// Recuperación de contraseña: usamos Supabase Auth como fuente de verdad (nunca
// se genera ni se guarda una contraseña temporal en texto plano). Supabase emite
// un token de un solo uso; nosotros mandamos el correo con nuestra propia marca
// apuntando a nuestro frontend, y luego intercambiamos ese token por la sesión.
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')
      .eq('email', email)
      .maybeSingle();

    if (!profile) {
      return res.status(404).json({ message: 'No hay usuario con ese correo' });
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      logger.error('Error al generar link de recuperación:', linkError);
      return res.status(500).json({ message: 'No se pudo generar el enlace de recuperación' });
    }

    const resetToken = linkData.properties.hashed_token;
    const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}`;

    const message = `Has solicitado restablecer tu contraseña en Indusecc SGC.\n\nPor favor haz clic en el siguiente enlace:\n\n${resetUrl}\n\nSi no solicitaste esto, ignora este correo.`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #8B0000; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">Recuperación de Contraseña</h2>
        <p>Hola, <strong>${profile.name}</strong>.</p>
        <p>Has solicitado restablecer tu contraseña en nuestra plataforma <strong>Indusecc SGC</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #8B0000; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Restablecer Contraseña</a>
        </div>
        <p style="font-size: 0.8em; color: #666;">Este enlace es de un solo uso. Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <p style="font-size: 0.8em; color: #666; word-break: break-all;">${resetUrl}</p>
        <hr />
        <p style="font-size: 0.7em; color: #999;">Indusecc SGC - Sistema de Gestión de Calidad</p>
      </div>
    `;

    try {
      await sendEmail({
        email: profile.email,
        subject: 'Recuperación de Contraseña - Indusecc SGC',
        message,
        html
      });

      res.status(200).json({
        success: true,
        data: 'Se ha enviado un enlace de recuperación a su correo electrónico.'
      });
    } catch (err) {
      logger.error('Error al enviar el correo:', err);
      return res.status(500).json({ message: 'No se pudo enviar el correo, intente más tarde' });
    }
  } catch (error) {
    logger.error('Error in forgotPassword:', error);
    res.status(500).json({ message: 'Error al procesar la solicitud' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const { data: otpData, error: otpError } = await supabaseAuth.auth.verifyOtp({
      type: 'recovery',
      token_hash: token,
    });

    if (otpError || !otpData?.user) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(otpData.user.id, { password });
    if (updateError) {
      logger.error('Error al actualizar contraseña:', updateError);
      return res.status(500).json({ message: 'Error al restablecer contraseña' });
    }

    res.status(200).json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
    });
  } catch (error) {
    logger.error('Error in resetPassword:', error);
    res.status(500).json({ message: 'Error al restablecer contraseña' });
  }
};

module.exports = { loginUser, refreshSession, demoLogin, demoStatus, uploadFile, registerUser, forgotPassword, resetPassword }

const { supabaseAdmin } = require('../config/supabaseClient')
const { DEMO_EMAIL_DOMAIN } = require('../config/environment')

// Cuentas de acceso rápido por rol (botones del login): demo-<rol>@<dominio>
const isDemoAccount = (email) => {
  const value = String(email || '').toLowerCase()
  return value.startsWith('demo-') && value.endsWith(`@${DEMO_EMAIL_DOMAIN}`)
}

const authenticate = async (req, res, next) => {
  const authHeader = req.header('Authorization')
  if (!authHeader) return res.status(401).json({ message: 'Acceso denegado' })

  const token = authHeader.replace('Bearer ', '')

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authData?.user) {
      return res.status(401).json({ message: 'Token inválido' })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, role, active')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      return res.status(401).json({ message: 'Perfil no encontrado' })
    }

    if (!profile.active) {
      return res.status(403).json({ message: 'Usuario desactivado' })
    }

    req.user = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role.toUpperCase(),
      isDemo: isDemoAccount(profile.email),
    }
    next()
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' })
  }
}

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Acceso denegado' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'No tienes permisos para esta acción' })
    }
    next()
  }
}

// Las cuentas de acceso rápido pueden usar toda la operación del SGC, pero no
// administrar cuentas ni credenciales reales (evita escalar privilegios desde el login público).
const blockDemo = (req, res, next) => {
  if (req.user?.isDemo) {
    return res.status(403).json({
      success: false,
      message: 'Esta acción no está disponible en las cuentas de demostración',
      code: 'DEMO_ACCOUNT_RESTRICTED',
    })
  }
  next()
}

module.exports = {
  authenticate,
  authorize,
  blockDemo,
  isDemoAccount,
}

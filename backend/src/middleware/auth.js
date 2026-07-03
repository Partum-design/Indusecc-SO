const { supabaseAdmin } = require('../config/supabaseClient')

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

module.exports = {
  authenticate,
  authorize,
}

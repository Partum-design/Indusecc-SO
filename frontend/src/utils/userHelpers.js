export function getInitials(name, email) {
  const source = (name || email || '').trim()
  if (!source) return 'US'
  const words = source.split(' ').filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function formatRole(role) {
  if (!role) return ''
  return role
    .toLowerCase()
    .split(/[_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const ROLE_BASE = {
  SUPER_ADMIN: '/superadmin',
  ADMIN: '/admin',
  COLABORADOR: '/colaborador',
  CONSULTOR: '/consultor',
}

// Prefijo de rutas del rol ('/admin', '/colaborador'...) o '/login' si no hay sesión válida.
export function roleBase(role) {
  return ROLE_BASE[String(role || '').toUpperCase()] || '/login'
}

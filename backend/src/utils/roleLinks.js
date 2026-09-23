// Rutas del frontend por rol. Las notificaciones guardan un enlace ya resuelto para
// el rol del destinatario, porque cada rol tiene su propia estructura de paginas.

const BASE_BY_ROLE = {
  SUPER_ADMIN: '/superadmin',
  ADMIN: '/admin',
  COLABORADOR: '/colaborador',
  CONSULTOR: '/consultor',
};

const PATHS = {
  documents: { SUPER_ADMIN: '/superadmin/documentos', ADMIN: '/admin/documentos-iso', COLABORADOR: '/colaborador/documentos', CONSULTOR: '/consultor/documentos' },
  tasks: { SUPER_ADMIN: '/superadmin/dashboard', ADMIN: '/admin/mejora-continua', COLABORADOR: '/colaborador/tareas', CONSULTOR: '/consultor/panel' },
  audits: { SUPER_ADMIN: '/superadmin/dashboard', ADMIN: '/admin/auditorias', COLABORADOR: '/colaborador/mipanel', CONSULTOR: '/consultor/auditorias' },
  findings: { SUPER_ADMIN: '/superadmin/dashboard', ADMIN: '/admin/auditorias', COLABORADOR: '/colaborador/hallazgos', CONSULTOR: '/consultor/hallazgos' },
  calendar: { SUPER_ADMIN: '/superadmin/dashboard', ADMIN: '/admin/calendario', COLABORADOR: '/colaborador/calendario', CONSULTOR: '/consultor/panel' },
  users: { SUPER_ADMIN: '/superadmin/usuarios', ADMIN: '/admin/usuarios-roles', COLABORADOR: '/colaborador/mipanel', CONSULTOR: '/consultor/panel' },
};

const roleBase = (role) => BASE_BY_ROLE[String(role || '').toUpperCase()] || '/login';

// linkKey: 'documents' | 'tasks' | 'audits' | 'findings' | 'calendar' | 'users' | 'notifications'
const resolveLink = (linkKey, role, query) => {
  const normalized = String(role || '').toUpperCase();
  const path = linkKey === 'notifications'
    ? `${roleBase(normalized)}/notificaciones`
    : PATHS[linkKey]?.[normalized] || roleBase(normalized);
  return query ? `${path}?${query}` : path;
};

module.exports = { roleBase, resolveLink };

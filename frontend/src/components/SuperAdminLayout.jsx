import { useState, useContext } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ToastContainer } from './Toast'
import NotificationsBell from './NotificationsBell'
import { getInitials, formatRole } from '../utils/userHelpers'
import { AuthContext } from '../context/AuthContext'

const navItems = [
  { section: 'Control Global' },
  { to: '/superadmin/dashboard', label: 'Panel Dios', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg> },
  { to: '/superadmin/configuracion', label: 'Configuración Global', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg> },
  { section: 'Gestión de Usuarios' },
  { to: '/superadmin/usuarios', label: 'Todos los Usuarios', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
  { to: '/superadmin/contrasenas', label: 'Generar / Resetear', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg> },
  { section: 'Auditoría y Logs' },
  { to: '/superadmin/notificaciones', label: 'Notificaciones', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg> },
  { to: '/superadmin/auditoria-logs', label: 'Logs del Sistema', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg> },
  { section: 'Norma ISO' },
  { to: '/superadmin/documentos', label: 'Documentos ISO', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg> },
  { to: '/superadmin/norma', label: 'Nodos de la Norma', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg> },
]

export default function SuperAdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const { user, logout } = useContext(AuthContext)

  const currentLabel = navItems.find(i => i.to && location.pathname === i.to)?.label || 'Panel Dios'
  const initials = getInitials(user?.name, user?.email)

  // Búsqueda rápida de secciones
  const searchResults = searchTerm.trim() 
    ? navItems.filter(i => i.to && i.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : []

  return (
    <div>
      <ToastContainer />
      <div className={`sb-overlay${sidebarOpen ? ' active' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sb-brand">
          <div className="sb-logo-box">
            <div className="sb-logo-fb">
              <span>SA</span>
            </div>
          </div>
          <div>
            <div className="sb-name">
              Super <em>Admin</em>
            </div>
            <div className="sb-sub">Control Total del Sistema</div>
          </div>
        </div>

        <nav className="sb-nav">
          {navItems.map((item, i) => item.section
            ? (
              <div className="sb-section" key={i}>{item.section}</div>
            )
            : (
              <button
                key={i}
                className={`nav-i${location.pathname === item.to ? ' active' : ''}`}
                onClick={() => { navigate(item.to); setSidebarOpen(false) }}
              >
                {item.icon}
                {item.label}
                {item.badge && (
                  <span className="nbadge">{item.badge}</span>
                )}
              </button>
            )
          )}
        </nav>

        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sb-uname">{user?.name || 'Super Admin'}</div>
              <div className="sb-urole" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {formatRole(user?.role) || 'Super Admin'}
              </div>
            </div>
          </div>
          <button className="sb-logout-btn" onClick={logout}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="layout">
        <header className="topbar">
          <button className="topbar-hbg" onClick={() => setSidebarOpen(true)}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <div className="topbar-bc">
            <span>Indusecc SO</span>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="13"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            <strong>{currentLabel}</strong>
          </div>

          <div className="topbar-r">
            {/* Buscador Dinámico */}
            <div className="tsearch" style={{ position: 'relative' }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/></svg>
              <input 
                type="text" 
                placeholder="Buscar sección..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: '0 0 8px 8px', boxShadow: '0 10px 20px rgba(0,0,0,.1)', zIndex: 500, marginTop: 5, overflow: 'hidden' }}>
                  {searchResults.map((res, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => { navigate(res.to); setSearchTerm('') }}
                      style={{ padding: '10px 12px', fontSize: '.8rem', cursor: 'pointer', borderBottom: idx < searchResults.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ color: 'var(--red)' }}>{res.icon}</span>
                      {res.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <NotificationsBell />

            {/* Perfil Dinámico */}
            <div style={{ position: 'relative' }}>
              <button className="tbtn" onClick={() => setShowProfile(v => !v)} style={{ overflow: 'hidden', padding: 0 }}>
                {initials ? (
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,var(--gold),var(--gold-d))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 700, color: 'var(--red-d)' }}>{initials}</div>
                ) : (
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                )}
              </button>
              {showProfile && (
                <div style={{ position: 'absolute', top: '100%', right: 0, width: 200, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,.15)', zIndex: 600, marginTop: 10, padding: 8 }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', marginBottom: 5 }}>
                    <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink)' }}>{user?.name || 'Super Admin'}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--ash)' }}>{user?.email}</div>
                  </div>
                  <button onClick={logout} style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', color: '#ef4444', fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', borderRadius: 4 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="14"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Super Admin badge banner */}
        <div style={{ background: 'var(--blue-bg)', borderBottom: '1px solid rgba(29,78,216,.1)', padding: '6px 1.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="14" style={{ color: 'var(--blue)', flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          <span style={{ fontSize: '.72rem', color: 'var(--blue)', fontWeight: 600, letterSpacing: '.05em' }}>
            MODO SUPER ADMIN — Control total del sistema. Todas las acciones quedan registradas en el log de auditoría.
          </span>
        </div>

        <div className="mobile-readonly-banner">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="15"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          Versión móvil — Solo lectura. Accede desde escritorio para editar.
        </div>
        <Outlet />
      </div>
    </div>
  )
}


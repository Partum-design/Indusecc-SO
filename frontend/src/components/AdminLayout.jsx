import { useState, useContext } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ToastContainer } from './Toast'
import NotificationsBell from './NotificationsBell'
import { getInitials, formatRole } from '../utils/userHelpers'
import { AuthContext } from '../context/AuthContext'

const navItems = [
  { section: 'Principal' },
  { to: '/admin/dashboard', label: 'Panel General', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { to: '/admin/documentos-iso', label: 'Documentos ISO', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg> },
  { to: '/admin/auditorias', label: 'Auditorías', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg> },
  { to: '/admin/mejora-continua', label: 'Mejora Continua', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> },
  { to: '/admin/calendario', label: 'Calendario', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> },
  { to: '/admin/riesgos', label: 'Matriz de Riesgos', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg> },
  { section: 'Administración' },
  { to: '/admin/usuarios-roles', label: 'Usuarios y Roles', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg> },
  { to: '/admin/configuracion', label: 'Configuración', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg> },
  { to: '/admin/notificaciones', label: 'Notificaciones', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg> },
  { to: '/admin/reportes', label: 'Reportes', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const { user, logout } = useContext(AuthContext)

  const currentLabel = navItems.find(i => i.to && location.pathname === i.to)?.label || 'Panel General'
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
            <div className="sb-logo-fb"><span>IO</span></div>
          </div>
          <div>
            <div className="sb-name">Indusecc <em>SO</em></div>
            <div className="sb-sub">Sistema Operativo</div>
          </div>
        </div>
        <nav className="sb-nav">
          {navItems.map((item, i) => item.section
            ? <div className="sb-section" key={i}>{item.section}</div>
            : (
              <button key={i} className={`nav-i${location.pathname === item.to ? ' active' : ''}`} onClick={() => { navigate(item.to); setSidebarOpen(false) }}>
                {item.icon}
                {item.label}
                {item.badge && <span className="nbadge">{item.badge}</span>}
              </button>
            )
          )}
        </nav>
        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sb-uname">{user?.name || 'Administrador'}</div>
              <div className="sb-urole">{formatRole(user?.role) || 'Administrador'}</div>
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
                    <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink)' }}>{user?.name || 'Administrador'}</div>
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
        <div className="mobile-readonly-banner">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="15"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          Versión móvil — Solo lectura. Accede desde escritorio para editar.
        </div>
        <Outlet />
      </div>
    </div>
  )
}

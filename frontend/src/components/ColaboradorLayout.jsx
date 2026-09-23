import { useState, useContext } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ToastContainer } from './Toast'
import NotificationsBell from './NotificationsBell'
import { getInitials, formatRole } from '../utils/userHelpers'
import { AuthContext } from '../context/AuthContext'

const navItems = [
  { section: 'Principal' },
  { to: '/colaborador/mipanel', label: 'Mi Panel' },
  { to: '/colaborador/documentos', label: 'Documentos ISO' },
  { to: '/colaborador/tareas', label: 'Mis Tareas' },
  { to: '/colaborador/reportar', label: 'Reportar Hallazgo' },
  { to: '/colaborador/riesgos', label: 'Matriz de Riesgos' },
  { to: '/colaborador/hallazgos', label: 'Mis Hallazgos' },
  { section: 'Consulta' },
  { to: '/colaborador/indicadores', label: 'Indicadores SGC' },
  { to: '/colaborador/capacitacion', label: 'Mis Capacitaciones' },
  { to: '/colaborador/calendario', label: 'Mi Calendario' },
  { to: '/colaborador/notificaciones', label: 'Notificaciones' },
]

function NavIcon({ to }) {
  const icons = {
    '/colaborador/mipanel': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
    '/colaborador/documentos': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>,
    '/colaborador/tareas': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>,
    '/colaborador/reportar': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
    '/colaborador/riesgos': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>,
    '/colaborador/hallazgos': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>,
    '/colaborador/indicadores': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
    '/colaborador/capacitacion': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>,
    '/colaborador/notificaciones': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
    '/colaborador/calendario': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  }
  return icons[to] || null
}

export default function ColaboradorLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const { user, logout } = useContext(AuthContext)
  const currentLabel = navItems.find(i => i.to && location.pathname === i.to)?.label || 'Mi Panel'
  const initials = getInitials(user?.name, user?.email)

  return (
    <div>
      <ToastContainer />
      <div className={`sb-overlay${sidebarOpen ? ' active' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sb-brand">
          <div className="sb-logo-box"><div className="sb-logo-fb"><span>IO</span></div></div>
          <div><div className="sb-name">Indusecc <em>SO</em></div><div className="sb-sub">Colaborador</div></div>
        </div>
        <nav className="sb-nav">
          {navItems.map((item, i) => item.section
            ? <div className="sb-section" key={i}>{item.section}</div>
            : (
              <button key={i} className={`nav-i${location.pathname === item.to ? ' active' : ''}`} onClick={() => { navigate(item.to); setSidebarOpen(false) }}>
                <NavIcon to={item.to} />{item.label}
                {item.badge && <span className="nbadge">{item.badge}</span>}
              </button>
            )
          )}
        </nav>
        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar">{initials}</div>
            <div style={{flex:1,minWidth:0}}><div className="sb-uname">{user?.name || 'Rosa Torres'}</div><div className="sb-urole">{formatRole(user?.role) || 'Colaborador · Producción'}</div></div>
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
            <div className="tsearch">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/></svg>
              <input type="text" placeholder="Buscar…" />
            </div>
            <NotificationsBell />
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
                    <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink)' }}>{user?.name || 'Colaborador'}</div>
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
          Versión móvil — Solo lectura.
        </div>
        <Outlet />
      </div>
    </div>
  )
}

import { useState, useContext } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ToastContainer } from './Toast'
import NotificationsBell from './NotificationsBell'
import { getInitials, formatRole } from '../utils/userHelpers'
import { AuthContext } from '../context/AuthContext'

const navItems = [
  { section:'Consultor' },
  { to:'/consultor/panel', label:'Panel General' },
  { to:'/consultor/indicadores', label:'Indicadores SGC' },
  { to:'/consultor/hallazgos', label:'Hallazgos del Sistema' },
  { to:'/consultor/riesgos', label:'Matriz de Riesgos' },
  { to:'/consultor/auditorias', label:'Auditorías' },
  { to:'/consultor/documentos', label:'Documentos ISO' },
  { to:'/consultor/reportes', label:'Reportes y Análisis' },
  { to:'/consultor/notificaciones', label:'Notificaciones' },
]

const icons = {
  '/consultor/panel': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  '/consultor/indicadores': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  '/consultor/hallazgos': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>,
  '/consultor/riesgos': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>,
  '/consultor/auditorias': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>,
  '/consultor/documentos': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>,
  '/consultor/notificaciones': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
  '/consultor/reportes': <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
}

export default function ConsultorLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const { user, logout } = useContext(AuthContext)
  const currentLabel = navItems.find(i => i.to && location.pathname === i.to)?.label || 'Panel General'
  const initials = getInitials(user?.name, user?.email)

  return (
    <div>
      <ToastContainer />
      <div className={`sb-overlay${sidebarOpen ? ' active' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sb-brand">
          <div className="sb-logo-box"><div className="sb-logo-fb"><span>IO</span></div></div>
          <div><div className="sb-name">Indusecc <em>SO</em></div><div className="sb-sub">Consultor SGC</div></div>
        </div>
        <nav className="sb-nav">
          {navItems.map((item, i) => item.section
            ? <div className="sb-section" key={i}>{item.section}</div>
            : (
              <button key={i} className={`nav-i${location.pathname === item.to ? ' active' : ''}`} onClick={() => { navigate(item.to); setSidebarOpen(false) }}>
                {icons[item.to]}{item.label}
              </button>
            )
          )}
        </nav>
        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar" style={{ background:'linear-gradient(135deg,#065F46,#10B981)', color:'#fff' }}>{initials}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="sb-uname">{user?.name || 'Carlos González'}</div>
              <div className="sb-urole">{formatRole(user?.role) || 'Consultor SGC · Solo Lectura'}</div>
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
            <div className="tsearch">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/></svg>
              <input type="text" placeholder="Buscar…" />
            </div>
            <NotificationsBell />
            <span className="readonly-badge" style={{ fontSize:'.7rem' }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              Solo Lectura
            </span>
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
                    <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink)' }}>{user?.name || 'Consultor'}</div>
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
        <Outlet />
      </div>
    </div>
  )
}

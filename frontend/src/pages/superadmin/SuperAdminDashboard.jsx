import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../../components/Toast'
import { downloadCSV } from '../../utils/downloadHelpers'
import { getUsers, getRoles, getAuditLogs, getComplianceReport } from '../../api/api'

const typeColor = { ok: '#10b981', blue: '#3b82f6', err: '#ef4444', warn: '#f59e0b', gold: 'var(--gold)' }

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('resumen')
  const [stats, setStats] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [roles, setRoles] = useState([])
  const [isoNodos, setIsoNodos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    try {
      setLoading(true)
      const [usersRes, rolesRes, logsRes, isoRes] = await Promise.all([
        getUsers(),
        getRoles(),
        getAuditLogs({ limit: 6 }),
        getComplianceReport()
      ])

      // Build stats
      const users = usersRes.data?.data?.users || usersRes.data?.data || []
      const userRles = rolesRes.data?.data?.roles || rolesRes.data?.data || []
      const logsArr = logsRes.data?.data?.logs || logsRes.data?.data || []
      const systemStats = [
        { v: 'red', num: userRles.length, lbl: 'Roles del Sistema', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>, trend: '+ Super Admin', tt: 'up', w: '100%' },
        { v: 'blue', num: users.length, lbl: 'Usuarios Totales', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, trend: `${users.filter(u => u.active !== false).length} activos`, tt: 'up', w: users.length ? `${Math.round((users.filter(u => u.active !== false).length / users.length) * 100)}%` : '0%' },
        { v: 'gold', num: logsRes.data?.data?.pagination?.total || logsRes.data?.pagination?.total || 0, lbl: 'Eventos en Log', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>, trend: 'Bitácora inmutable', tt: 'n', w: '100%' },
        { v: 'red', num: (Array.isArray(logsArr) ? logsArr : []).filter(l => l.status === 'Error').length, lbl: 'Alertas Críticas', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>, trend: 'Revisar ya', tt: 'n', w: '30%' },
      ]
      setStats(systemStats)

      // Format logs
      const formatted = (logsRes.data?.data?.logs || logsRes.data?.data || []).map(log => ({
        user: log.user?.name || 'Sistema',
        role: log.user?.role || 'Sistema',
        action: log.description,
        time: new Date(log.createdAt).toLocaleString('es-MX'),
        type: log.status === 'Éxito' ? 'ok' : log.status === 'Error' ? 'err' : 'blue'
      }))
      setRecentLogs(formatted)

      // Format roles with user counts
      const roleWithCounts = (userRles || []).map((r, index) => ({
        name: r.name,
        usuarios: users.filter(u => u.role === r._id || u.role === r.name).length,
        color: ['var(--red)', '#3b82f6', '#f59e0b', '#10b981', '#6b7280', 'var(--red-d)'][index % 6],
        bg: ['rgba(123,30,34,.08)', 'rgba(59,130,246,.08)', 'rgba(245,158,11,.08)', 'rgba(16,185,129,.08)', 'rgba(107,114,128,.08)', 'var(--red-b)'][index % 6]
      }))
      setRoles(roleWithCounts)

      // Format ISO nodos
      if (isoRes.data?.data?.clauses) {
        const formatted = isoRes.data.data.clauses.slice(0, 7).map(c => ({
          num: c.number,
          title: c.title,
          state: c.completion === 100 ? 'Completado' : c.completion > 0 ? 'En Progreso' : 'Pendiente',
          pct: c.completion || 0
        }))
        setIsoNodos(formatted)
      }
    } catch (err) {
      toast(`Error cargando datos: ${err.message}`, 'err')
    } finally {
      setLoading(false)
    }
  }

  const exportGlobalReport = () => {
    const reportRows = stats.map(item => ({
      indicador: item.lbl,
      valor: item.num,
      tendencia: item.trend,
      estado: item.tt,
    }))
    downloadCSV(reportRows, 'reporte-global-superadmin.csv')
    toast('Reporte global descargado.', 'ok')
  }

  const exportLogsCSV = () => {
    const logRows = recentLogs.map(log => ({
      usuario: log.user,
      rol: log.role,
      accion: log.action,
      hora: log.time,
      tipo: log.type,
    }))
    downloadCSV(logRows, 'auditoria-logs-superadmin.csv')
    toast('Log de auditoría descargado.', 'ok')
  }

  return (
    <main className="page">
      <div className="ph">
        <div>
          <h1 className="ph-title">
            Panel <em>Virtual</em>
          </h1>
          <p className="ph-sub">Control total del sistema — visión 360° de todos los módulos y usuarios</p>
        </div>
        <div className="ph-actions">
          <button className="btn btn-out" onClick={exportGlobalReport}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Exportar Reporte
          </button>
          <button className="btn btn-red"
            onClick={() => navigate('/superadmin/configuracion')}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
            Config. Global
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="sg sg-4" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {stats.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: 'var(--ash)' }}>Cargando estadísticas...</div>
        ) : (
          stats.map((s, i) => (
            <div key={i} className={`sc sc-${s.v}`}>
              <div className="sc-top">
                <div className="sc-icon">{s.icon}</div>
                <span className={`trend trend-${s.tt}`}>{s.trend}</span>
              </div>
              <div className="sc-num">{s.num}</div>
              <div className="sc-lbl">{s.lbl}</div>
              <div className="sc-bar"><div className="sc-bar-f" style={{ width: s.w }} /></div>
            </div>
          ))
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.2rem', borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[{ id: 'resumen', label: 'Resumen Global' }, { id: 'logs', label: 'Últimos Logs' }, { id: 'norma', label: 'Nodos ISO' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '8px 18px', fontSize: '.82rem', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', borderBottom: activeTab === t.id ? '2px solid var(--red)' : '2px solid transparent', color: activeTab === t.id ? 'var(--red)' : 'var(--ash)', transition: 'all .2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'resumen' && (
        <div className="mg">
          {/* Accesos rápidos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div className="card">
              <div className="card-hd">
                <div className="card-hd-l">
                  <div className="card-ico" style={{ background: 'var(--red-b)', color: 'var(--red)' }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div><div className="card-title">Acciones Rápidas</div></div>
                </div>
              </div>
              <div style={{ padding: '0 1.3rem 1.3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}>
                {[
                  { icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>, label: 'Crear Usuario', sub: 'Cualquier nivel', action: () => navigate('/superadmin/usuarios') },
                  { icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>, label: 'Resetear Contraseña', sub: 'Todos los niveles', action: () => navigate('/superadmin/contrasenas') },
                  { icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>, label: 'Configuración Global', sub: 'Sistema completo', action: () => navigate('/superadmin/configuracion') },
                  { icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>, label: 'Ver Logs', sub: `${stats[2]?.num || 0} eventos`, action: () => setActiveTab('logs') },
                  { icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>, label: 'Eliminar Usuario', sub: 'Con confirmación', action: () => navigate('/superadmin/usuarios') },
                  { icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>, label: 'Bloquear Acceso', sub: 'Suspender sesión', action: () => alert('Función en desarrollo') },
                ].map((a, i) => (
                  <button key={i} onClick={a.action}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all .2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-b)'; e.currentTarget.style.borderColor = 'rgba(123,30,34,.2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                    <span style={{ color: 'var(--red)' }}>{a.icon}</span>
                    <div>
                      <div style={{ fontSize: '.83rem', fontWeight: 700, color: 'var(--ink)' }}>{a.label}</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--ash)' }}>{a.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Log reciente */}
            <div className="card">
              <div className="card-hd">
                <div className="card-hd-l">
                  <div className="card-ico" style={{ background: 'rgba(59,130,246,.08)', color: '#3b82f6' }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <div><div className="card-title">Actividad Reciente</div></div>
                </div>
              </div>
              <div style={{ padding: '0 1rem 1rem' }}>
                {recentLogs.slice(0, 4).map((l, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 6px', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColor[l.type], marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.action}</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--ash)' }}>{l.user} · {l.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Col derecha */}
          <div className="col-r">
            <div className="card">
              <div className="card-hd">
                <div className="card-hd-l">
                  <div className="card-ico" style={{ background: 'var(--gold-b)', color: 'var(--gold)' }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </div>
                  <div><div className="card-title">Roles Activos</div></div>
                </div>
              </div>
              <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                {roles.length === 0 ? (
                  <div style={{ color: 'var(--ash)', fontSize: '.8rem' }}>Cargando roles...</div>
                ) : (
                  roles.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: r.bg, borderRadius: 6, border: `1px solid ${r.color}22` }}>
                      <span style={{ fontSize: '.82rem', fontWeight: 600, color: r.color }}>{r.name}</span>
                      <span style={{ fontSize: '.75rem', color: 'var(--ash)' }}>{r.usuarios} usuarios</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Salud del sistema */}
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-hd">
                <div className="card-hd-l">
                  <div className="card-ico" style={{ background: 'rgba(16,185,129,.1)', color: '#10b981' }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div><div className="card-title">Salud del Sistema</div></div>
                </div>
              </div>
              <div style={{ padding: '0 1.2rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '.7rem' }}>
                {[
                  { label: 'Base de datos', val: '98%', ok: true },
                  { label: 'Almacenamiento', val: '67%', ok: true },
                  { label: 'Usuarios activos', val: '86%', ok: true },
                  { label: 'Logs activos', val: '100%', ok: true },
                ].map((m, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', marginBottom: 3 }}>
                      <span style={{ color: 'var(--ash)' }}>{m.label}</span>
                      <span style={{ color: m.ok ? '#10b981' : '#ef4444', fontWeight: 700 }}>{m.val}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 4 }}>
                      <div style={{ height: '100%', width: m.val, background: m.ok ? '#10b981' : '#ef4444', borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="card">
          <div className="card-hd">
            <div className="card-hd-l">
              <div className="card-ico" style={{ background: 'var(--gold-b)', color: 'var(--gold)' }}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              </div>
              <div><div className="card-title">Log de Auditoría — Eventos Recientes</div></div>
            </div>
            <button className="btn btn-out" style={{ fontSize: '.78rem', padding: '6px 14px' }}
              onClick={exportLogsCSV}>
              Exportar CSV
            </button>
          </div>
          <div style={{ padding: '0 1rem 1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['', 'Usuario', 'Rol', 'Acción', 'Hora'].map((h, i) => (
                    <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--ash)', fontSize: '.72rem', letterSpacing: '.08em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentLogs.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--ash)' }}>No hay logs disponibles</td></tr>
                ) : (
                  recentLogs.map((l, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColor[l.type] }} />
                      </td>
                      <td style={{ padding: '10px 10px', fontWeight: 600, color: 'var(--ink)' }}>{l.user}</td>
                      <td style={{ padding: '10px 10px' }}>
                        <span style={{ fontSize: '.7rem', padding: '2px 8px', borderRadius: 10, background: `${typeColor[l.type]}18`, color: typeColor[l.type], fontWeight: 700 }}>{l.role}</span>
                      </td>
                      <td style={{ padding: '10px 10px', color: 'var(--ash)' }}>{l.action}</td>
                      <td style={{ padding: '10px 10px', color: 'var(--ash)', whiteSpace: 'nowrap' }}>{l.time}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'norma' && (
        <div className="card">
          <div className="card-hd">
            <div className="card-hd-l">
              <div className="card-ico" style={{ background: 'var(--red-b)', color: 'var(--red)' }}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              </div>
              <div>
                <div className="card-title">Nodos ISO 9001:2015 — Acceso Total</div>
                <div style={{ fontSize: '.73rem', color: 'var(--ash)' }}>Super Admin tiene acceso sin restricciones a todos los nodos</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '0 1.2rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isoNodos.length === 0 ? (
              <div style={{ color: 'var(--ash)', padding: '1rem', textAlign: 'center' }}>Cargando nodos ISO...</div>
            ) : (
              isoNodos.map((n, i) => (
                <div key={i} className="card-item-hover"
                  style={{ padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', transition: 'all .2s' }}
                  onClick={() => navigate('/superadmin/norma')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--red)' }}>{n.num}</span>
                      <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--ink)' }}>{n.title}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '.72rem', fontWeight: 700, color: n.pct === 100 ? '#10b981' : n.pct >= 75 ? '#f59e0b' : 'var(--red)' }}>{n.state}</span>
                      <span style={{ fontSize: '.72rem', color: 'var(--red)', fontWeight: 700 }}>{n.pct}%</span>
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="14" style={{ color: 'var(--red)' }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${n.pct}%`, background: n.pct === 100 ? '#10b981' : n.pct >= 75 ? '#f59e0b' : 'var(--red)', borderRadius: 4, transition: 'width .5s' }} />
                  </div>
                </div>
              )))}
          </div>
        </div>
      )}
    </main>
  )
}

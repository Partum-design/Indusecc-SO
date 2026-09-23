import { useState, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/Modal'
import { toast } from '../../components/Toast'
import { AuthContext } from '../../context/AuthContext'
import { 
  getActions, 
  getDocuments, 
  getUserPerformance, 
  getCalendars,
  getComplianceReport
} from '../../api/api'
import { STATUS_META, downloadDocumentFile } from '../../utils/documents'

function TaskItem({ label, meta, pri, priClass, initDone, urgente }) {
  const [done, setDone] = useState(initDone)
  return (
    <div className="task-item" style={urgente ? { background: 'rgba(254,226,226,.2)', borderColor: 'rgba(155,28,28,.2)' } : {}}>
      <div className={`task-check${done ? ' done' : ''}`} onClick={() => { setDone(d => !d); toast(!done ? '¡Tarea completada!' : 'Tarea reabierta', !done ? 'ok' : 'n') }}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
      </div>
      <div className="task-txt">
        <div className={`task-title${done ? ' done-txt' : ''}`}>{label}</div>
        <div className="task-meta">{meta}</div>
      </div>
      <span className={`task-pri ${priClass}`}>{pri}</span>
    </div>
  )
}

export default function MiPanel() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [modalPerfil, setModalPerfil] = useState(false)
  const [tasks, setTasks] = useState([])
  const [recentDocuments, setRecentDocuments] = useState([])
  const [userPerformance, setUserPerformance] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [dashboardStats, setDashboardStats] = useState([])
  const [loading, setLoading] = useState(true)

  const userName = user?.name || user?.email?.split('@')[0] || 'Usuario'
  const userEmail = user?.email || 'usuario@indusecc.com'
  const userRole = user?.role || 'COLABORADOR'

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true)

      let actionsList = []
      let documentsList = []
      let performanceList = []
      let calendarsList = []

      try {
        const actionsResponse = await getActions()
        actionsList = actionsResponse.data?.data?.actions || actionsResponse.data?.actions || []
      } catch (error) {
        console.error('Error loading actions:', error)
      }

      try {
        const documentsResponse = await getDocuments()
        documentsList = documentsResponse.data?.data?.documents || documentsResponse.data?.documents || []
      } catch (error) {
        console.error('Error loading documents:', error)
      }

      try {
        const performanceResponse = await getUserPerformance()
        const perfData = performanceResponse.data?.data?.performance || performanceResponse.data?.performance || []
        
        // Transform backend data to frontend format
        performanceList = perfData.map(item => ({
          label: item.label,
          current: item.value?.split('/')[0] || '0',
          target: item.value?.split('/')[1] || '0',
          percentage: item.percentage || 0,
          color: item.color || 'var(--ok)',
          gradient: `linear-gradient(to right, ${item.color || '#166534'}, ${item.color || '#16A34A'})`
        }))
      } catch (error) {
        console.error('Error loading user performance:', error)
      }

      try {
        const calendarsResponse = await getCalendars()
        calendarsList = calendarsResponse.data?.data?.calendars || calendarsResponse.data?.calendars || []
      } catch (error) {
        console.error('Error loading calendars:', error)
      }

      // Filtrar tareas pendientes (status !== 'Cerrada')
      const pendingTasks = actionsList.filter(action => action.status !== 'Cerrada').slice(0, 3)
      setTasks(pendingTasks)
      setRecentDocuments(documentsList)
      setUserPerformance(performanceList)

      const upcoming = calendarsList
        .filter(event => new Date(event.date) >= new Date())
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 3)
      setUpcomingEvents(upcoming)

      let compliance = 0
      let requirementsLabel = 'Sin datos'
      try {
        const complianceResponse = await getComplianceReport()
        const report = complianceResponse.data?.data
        compliance = report?.completion?.overall ?? 0
        requirementsLabel = `${report?.requirements?.completed ?? 0}/${report?.requirements?.total ?? 0} req.`
      } catch (error) {
        console.error('Error loading compliance:', error)
      }

      const stats = [
        {
          v: 'blue',
          icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>,
          trend: `+${documentsList.length}`,
          tt: 'up',
          num: documentsList.length || '0',
          lbl: 'Documentos disponibles',
          w: '78%'
        },
        {
          v: 'ok',
          icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
          trend: requirementsLabel,
          tt: compliance >= 80 ? 'up' : 'n',
          num: `${compliance}%`,
          lbl: 'Cumplimiento SGC',
          w: `${compliance}%`
        },
        {
          v: 'warn',
          icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>,
          trend: `${pendingTasks.length} abiertas`,
          tt: pendingTasks.length > 0 ? 'dn' : 'n',
          num: pendingTasks.length.toString(),
          lbl: 'Tareas pendientes',
          w: `${Math.min(pendingTasks.length * 10, 100)}%`
        },
        {
          v: 'gold',
          icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
          trend: 'Q1',
          tt: 'n',
          num: upcoming.length.toString(),
          lbl: 'Próximos eventos',
          w: `${Math.min(upcoming.length * 20, 100)}%`
        }
      ]
      setDashboardStats(stats)
      setLoading(false)
    }

    loadDashboardData()
  }, [])

  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'

  const handleDownloadDocument = async (doc) => {
    try {
      await downloadDocumentFile(doc.id || doc._id)
      toast(`Descargando ${doc.code}`, 'ok')
    } catch (error) {
      console.error('Error downloading document:', error)
      toast('Error al descargar el documento', 'err')
    }
  }

  // Abre el visor del gestor documental (vista previa, firmas y descarga).
  const handleViewDocument = (doc) => {
    navigate(`/colaborador/documentos?doc=${doc.id || doc._id}`)
  }

  return (
    <main className="page">
      {/* Banner bienvenida */}
      <div style={{ background: 'linear-gradient(135deg,var(--red-k) 0%,var(--red-d) 60%,var(--red-m) 100%)', borderRadius: 10, padding: '1.6rem 2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.4rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,transparent,transparent 28px,rgba(201,168,76,.04) 28px,rgba(201,168,76,.04) 29px)', pointerEvents: 'none' }} />
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg,var(--gold-d),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 700, color: 'var(--red-d)', flexShrink: 0, boxShadow: '0 4px 14px rgba(0,0,0,.3)', position: 'relative', zIndex: 1 }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.38)', textTransform: 'uppercase', letterSpacing: '.15em', fontWeight: 700, marginBottom: '.2rem' }}>Bienvenido de nuevo</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.4rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{userName}</div>
          <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.4)', marginTop: '.25rem' }}>{userRole.replace('_', ' ')}</div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '.5rem', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '.6rem' }}>
            <button className="btn btn-gold btn-sm" onClick={() => setModalPerfil(true)}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="13"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>Mi Perfil
            </button>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.75)', border: '1px solid rgba(255,255,255,.15)' }} onClick={() => navigate('/colaborador/reportar')}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="13"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>Nuevo Hallazgo
            </button>
          </div>
          <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.3)' }}>{userEmail}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="sg" style={{ marginBottom: '1.4rem' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px', color: 'var(--ash)' }}>
            Cargando estadísticas...
          </div>
        ) : (
          dashboardStats.map((s, i) => (
            <div key={i} className={`sc sc-${s.v}`}>
              <div className="sc-top"><div className="sc-icon">{s.icon}</div><span className={`trend trend-${s.tt}`}>{s.trend}</span></div>
              <div className="sc-num">{s.num}</div><div className="sc-lbl">{s.lbl}</div>
              <div className="sc-bar"><div className="sc-bar-f" style={{width:s.w}}/></div>
            </div>
          ))
        )}
      </div>

      <div className="mg" style={{ marginBottom: '1.2rem' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>
          {/* Mis Tareas */}
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-warn"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg></div>
                <div><div className="card-title">Mis Tareas</div><div className="card-sub">Acciones asignadas a ti</div></div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/colaborador/tareas')}>Ver todas</button>
            </div>
            <div style={{ padding: '.8rem 1rem' }}>
              {loading ? (
                <div style={{textAlign: 'center', color: 'var(--ash)', padding: '1rem'}}>Cargando tareas...</div>
              ) : tasks.length > 0 ? (
                tasks.map((task, index) => (
                  <TaskItem 
                    key={task._id || index}
                    label={task.title || task.description}
                    meta={<>Vence: <strong style={{color: task.priority === 'high' ? 'var(--err)' : task.priority === 'medium' ? 'var(--warn)' : 'var(--ok)'}}>
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString('es-ES') : 'Sin fecha'}
                    </strong> · {task.type || 'Tarea'}</>}
                    pri={task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                    priClass={task.priority === 'high' ? 'pri-h' : task.priority === 'medium' ? 'pri-m' : 'pri-l'}
                    initDone={task.completed || false}
                    urgente={task.priority === 'high'}
                  />
                ))
              ) : (
                <div style={{textAlign: 'center', color: 'var(--ash)', padding: '1rem'}}>No hay tareas asignadas</div>
              )}
            </div>
          </div>

          {/* Documentos recientes */}
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-blue"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg></div>
                <div><div className="card-title">Documentos Recientes</div><div className="card-sub">Últimas actualizaciones</div></div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/colaborador/documentos')}>Ver todos</button>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Código</th><th>Nombre</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="4" style={{textAlign: 'center', color: 'var(--ash)', padding: '1rem'}}>Cargando documentos...</td></tr>
                  ) : recentDocuments.length > 0 ? (
                    recentDocuments.map((doc, i) => (
                      <tr key={doc._id || i}>
                        <td style={{fontSize:'.73rem',color:'var(--ash)',fontFamily:'monospace'}}>{doc.code}</td>
                        <td>
                          <div className="dn">
                            <div className="dn-ico" style={doc.expiringSoon ? {background:'var(--warn-bg)',color:'var(--warn)'} : {}}>
                              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                              </svg>
                            </div>
                            <div>
                              <div className="dn-title">{doc.title}</div>
                              <div className="dn-code">{doc.version} · {new Date(doc.updatedAt).toLocaleDateString('es-ES')}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${(STATUS_META[doc.status] || STATUS_META.vigente).cls}`}>
                            {doc.expiringSoon ? 'Por vencer' : (STATUS_META[doc.status] || STATUS_META.vigente).label}
                          </span>
                        </td>
                        <td>
                          <div style={{display:'flex',gap:'.3rem'}}>
                            <button className="ibtn" onClick={() => handleViewDocument(doc)}>
                              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                              </svg>
                            </button>
                            <button className="ibtn" onClick={() => handleDownloadDocument(doc)}>
                              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="4" style={{textAlign: 'center', color: 'var(--ash)', padding: '1rem'}}>No hay documentos recientes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mi Progreso */}
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-ok"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div>
                <div><div className="card-title">Mi Progreso</div><div className="card-sub">Indicadores personales del mes</div></div>
              </div>
            </div>
            <div style={{padding:'1rem 1.2rem',display:'flex',flexDirection:'column',gap:'.85rem'}}>
              {loading ? (
                <div style={{textAlign: 'center', color: 'var(--ash)', padding: '1rem'}}>Cargando métricas...</div>
              ) : userPerformance.length > 0 ? (
                userPerformance.map((metric, i) => (
                  <div key={metric._id || i}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.4rem'}}>
                      <span style={{fontSize:'.79rem',fontWeight:600}}>{metric.label}</span>
                      <span style={{fontSize:'.79rem',fontWeight:700,color:metric.color || 'var(--ok)'}}>
                        {metric.current}/{metric.target}
                      </span>
                    </div>
                    <div className="prog-wrap">
                      <div className="prog-fill" style={{
                        width:`${metric.percentage || 0}%`,
                        background: metric.gradient || 'linear-gradient(to right,#166534,#16A34A)'
                      }}/>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{textAlign: 'center', color: 'var(--ash)', padding: '1rem'}}>No hay métricas disponibles</div>
              )}
            </div>
          </div>
        </div>

        {/* Col derecha */}
        <div className="col-r">
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l"><div className="card-ico ico-ink"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></div><div><div className="card-title">Acceso Rápido</div></div></div>
            </div>
            <div className="qg">
              {[
                {label:'Documentos',path:'/colaborador/documentos',r:true,icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>},
                {label:'Mis Tareas',path:'/colaborador/tareas',r:true,icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>},
                {label:'Reportar',path:'/colaborador/reportar',icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>},
                {label:'Indicadores',path:'/colaborador/indicadores',icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10"/></svg>},
                {label:'Capacitación',path:'/colaborador/capacitacion',icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/></svg>},
                {label:'Manual SGC',action:()=>toast('Descargando Manual SGC…','ok'),icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>},
              ].map((q,i) => (
                <button key={i} className={`qbtn${q.r?' qbtn-r':''}`} onClick={q.action||(() => navigate(q.path))}>
                  {q.icon}{q.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-hd"><div className="card-hd-l"><div className="card-ico ico-gold"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div><div><div className="card-title">Próximos Eventos</div></div></div></div>
            <div style={{padding:'.7rem 1rem',display:'flex',flexDirection:'column',gap:'.5rem'}}>
              {loading ? (
                <div style={{textAlign: 'center', color: 'var(--ash)', padding: '1rem'}}>Cargando eventos...</div>
              ) : upcomingEvents.length > 0 ? (
                upcomingEvents.map((event, i) => {
                  const eventDate = new Date(event.date)
                  const day = eventDate.getDate().toString().padStart(2, '0')
                  const month = eventDate.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()
                  const time = event.time || '9:00 AM'
                  const location = event.location || 'Por definir'

                  return (
                    <div key={event._id || i} style={{
                      display:'flex',
                      gap:10,
                      padding:9,
                      background: event.priority === 'high' ? 'var(--err-bg)' : event.priority === 'medium' ? 'var(--warn-bg)' : 'var(--blue-bg)',
                      borderRadius:7,
                      border:`1px solid ${event.priority === 'high' ? 'rgba(155,28,28,.1)' : event.priority === 'medium' ? 'rgba(180,83,9,.1)' : 'rgba(29,78,216,.1)'}`
                    }}>
                      <div style={{textAlign:'center',flexShrink:0,width:34}}>
                        <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1rem',fontWeight:900,color:event.priority === 'high' ? 'var(--err)' : event.priority === 'medium' ? 'var(--warn)' : 'var(--blue)',lineHeight:1}}>{day}</div>
                        <div style={{fontSize:8,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--ash)'}}>{month}</div>
                      </div>
                      <div style={{width:1,background:event.priority === 'high' ? 'rgba(155,28,28,.1)' : event.priority === 'medium' ? 'rgba(180,83,9,.1)' : 'rgba(29,78,216,.1)',flexShrink:0}}/>
                      <div>
                        <div style={{fontSize:'.8rem',fontWeight:600}}>{event.title}</div>
                        <div style={{fontSize:'.69rem',color:'var(--ash)'}}>{location} · {time}</div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{textAlign: 'center', color: 'var(--ash)', padding: '1rem'}}>No hay próximos eventos</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-hd"><div className="card-hd-l"><div className="card-ico ico-warn"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg></div><div><div className="card-title">Mis Alertas</div><div className="card-sub">2 requieren atención</div></div></div></div>
            <div className="al-list">
              <div className="al al-err"><svg className="al-ico" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="15"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg><div><div className="al-ttl">Tarea vence en 2 días</div><div className="al-sub">Actualizar FO-CAL-012 — Urgente</div></div></div>
              <div className="al al-warn"><svg className="al-ico" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="15"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg><div><div className="al-ttl">Auditoría en 11 días</div><div className="al-sub">Prepara tus documentos del área</div></div></div>
              <div className="al al-ok"><svg className="al-ico" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="15"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div><div className="al-ttl">Capacitación completada</div><div className="al-sub">ISO 9001 Módulo 2 — 100%</div></div></div>
            </div>
          </div>
        </div>
      </div>

      <button className="fab" onClick={() => navigate('/colaborador/reportar')} title="Reportar Hallazgo">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="22"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
      </button>

      <Modal title="Mi Perfil" open={modalPerfil} onClose={() => setModalPerfil(false)}
        footer={<><button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>Cerrar Sesión</button><button className="btn btn-ghost btn-sm" onClick={() => setModalPerfil(false)}>Cancelar</button><button className="btn btn-red btn-sm" onClick={() => { toast('Perfil actualizado','ok'); setModalPerfil(false) }}>Guardar Cambios</button></>}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'.6rem',padding:'1.2rem',background:'linear-gradient(135deg,var(--red-k),var(--red-d))',borderRadius:8,marginBottom:'1.4rem'}}>
          <div style={{width:70,height:70,borderRadius:'50%',background:'linear-gradient(135deg,var(--gold-d),var(--gold))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.5rem',fontWeight:700,color:'var(--red-d)',boxShadow:'0 4px 14px rgba(0,0,0,.3)'}}>{userName.charAt(0).toUpperCase()}</div>
          <div style={{textAlign:'center'}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.2rem',fontWeight:900,color:'#fff'}}>{userName}</div><div style={{fontSize:'.75rem',color:'rgba(255,255,255,.45)',marginTop:'.2rem'}}>{userRole.replace('_',' ')}</div></div>
          <span className="badge b-gray">Colaborador</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'.6rem',marginBottom:'1.4rem'}}>
          {[{n:'42',l:'Docs vistos'},{n:'5/7',l:'Tareas',c:'var(--ok)'},{n:'94%',l:'Cumplimiento',c:'var(--ok)'}].map((s,i) => (
            <div key={i} style={{textAlign:'center',background:'var(--surface)',borderRadius:7,padding:'.8rem'}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.3rem',fontWeight:900,color:s.c||'var(--ink)'}}>{s.n}</div>
              <div style={{fontSize:'.68rem',color:'var(--ash)',fontWeight:600}}>{s.l}</div>
            </div>
          ))}
        </div>
        <div className="form-grid">
          <div className="form-group"><label className="lbl">Nombre</label><input className="finput" defaultValue={userName} readOnly /></div>
          <div className="form-group"><label className="lbl">Correo</label><input className="finput" defaultValue={userEmail} readOnly /></div>
          <div className="form-group"><label className="lbl">Rol</label><input className="finput" defaultValue={userRole.replace('_',' ')} readOnly /></div>
          <div className="form-group"><label className="lbl">Ext.</label><input className="finput" defaultValue="2042"/></div>
        </div>
      </Modal>
    </main>
  )
}

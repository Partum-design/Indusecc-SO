import { useState, useEffect } from 'react'
import { toast } from '../../components/Toast'
import {
  getUserTrainings,
  getUserCertificates,
  updateTrainingProgress,
  downloadCertificate
} from '../../api/api'

export default function Capacitacion() {
  const [trainings, setTrainings] = useState([])
  const [certificates, setCertificates] = useState([])
  const [stats, setStats] = useState({
    completed: 0,
    inProgress: 0,
    pending: 0,
    averageScore: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Intentar cargar capacitaciones del usuario
        const trainingsResponse = await getUserTrainings()

        if (trainingsResponse.data?.success) {
          setTrainings(trainingsResponse.data.data.trainings)
          setStats(trainingsResponse.data.data.stats)
        }

        // Cargar certificados
        const certificatesResponse = await getUserCertificates()
        if (certificatesResponse.data?.success) {
          setCertificates(certificatesResponse.data.data.certificates)
        }

      } catch (err) {
        console.error('Error loading training data:', err)
        setError('Error al cargar capacitaciones. Verifica tu conexión.')
        toast('Error al cargar capacitaciones', 'err')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleContinueTraining = async (training) => {
    try {
      if (training.status === 'Pendiente') {
        // Cambiar a "En proceso" y empezar
        await updateTrainingProgress(training._id, {
          status: 'En proceso',
          progress: Math.max(training.progress, 10)
        })
        toast('Capacitación iniciada', 'ok')

        // Recargar datos
        const response = await getUserTrainings()
        if (response.data?.success) {
          setTrainings(response.data.data.trainings)
          setStats(response.data.data.stats)
        }
      } else if (training.status === 'En proceso') {
        // Simular progreso adicional
        const newProgress = Math.min(training.progress + 15, 100)
        await updateTrainingProgress(training._id, { progress: newProgress })
        toast(`Progreso actualizado: ${newProgress}%`, 'ok')

        // Recargar datos
        const response = await getUserTrainings()
        if (response.data?.success) {
          setTrainings(response.data.data.trainings)
          setStats(response.data.data.stats)
        }
      }
    } catch (err) {
      console.error('Error updating training progress:', err)
      toast('Error al actualizar capacitación', 'err')
    }
  }

  const handleDownloadCertificate = async (certificateId) => {
    try {
      const response = await downloadCertificate(certificateId)
      if (response.data?.success) {
        toast('Certificado descargado exitosamente', 'ok')
      }
    } catch (err) {
      console.error('Error downloading certificate:', err)
      toast('Error al descargar certificado', 'err')
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completado':
        return { badge: 'b-ok', color: 'var(--ok)' }
      case 'En proceso':
        return { badge: 'b-blue', color: 'var(--blue)' }
      case 'Pendiente':
        return { badge: 'b-warn', color: 'var(--gold)' }
      default:
        return { badge: 'b-gray', color: 'var(--ash)' }
    }
  }

  const getNextTraining = () => {
    const inProgress = trainings.find(t => t.status === 'En proceso')
    if (inProgress) return inProgress

    const pending = trainings.filter(t => t.status === 'Pendiente')
      .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))[0]
    return pending
  }

  const nextTraining = getNextTraining()
  return (
    <main className="page">
      <div className="ph">
        <div><div className="ph-title">Mis <em>Capacitaciones</em></div><div className="ph-sub">Formación SGC asignada a tu perfil</div></div>
        <div className="ph-actions">
          <button
            className="btn btn-out"
            onClick={() => {
              if (certificates.length > 0) {
                toast(`Tienes ${certificates.length} certificado(s) disponible(s)`, 'ok')
              } else {
                toast('No hay certificados disponibles', 'n')
              }
            }}
            disabled={loading}
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Mis Certificados ({certificates.length})
          </button>
        </div>
      </div>

      <div className="sg">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px', color: 'var(--ash)' }}>
            Cargando estadísticas...
          </div>
        ) : (
          [
            {
              v:'ok',
              num: stats.completed,
              lbl:'Completadas',
              trend:'✓',
              tt:'up',
              w: trainings.length > 0 ? `${Math.round((stats.completed / trainings.length) * 100)}%` : '0%',
              icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            },
            {
              v:'blue',
              num: stats.inProgress,
              lbl:'En Proceso',
              trend:'Activa',
              tt:'n',
              w: trainings.length > 0 ? `${Math.round((stats.inProgress / trainings.length) * 100)}%` : '0%',
              icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            },
            {
              v:'warn',
              num: stats.pending,
              lbl:'Pendientes',
              trend:'Prog.',
              tt:'n',
              w: trainings.length > 0 ? `${Math.round((stats.pending / trainings.length) * 100)}%` : '0%',
              icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/></svg>
            },
            {
              v:'gold',
              num: stats.averageScore > 0 ? `${stats.averageScore}%` : '—',
              lbl:'Promedio General',
              trend:'↑',
              tt:'up',
              w: `${stats.averageScore}%`,
              icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
            },
          ].map((s,i) => (
            <div key={i} className={`sc sc-${s.v}`}>
              <div className="sc-top"><div className="sc-icon">{s.icon}</div><span className={`trend trend-${s.tt}`}>{s.trend}</span></div>
              <div className="sc-num">{s.num}</div><div className="sc-lbl">{s.lbl}</div>
              <div className="sc-bar"><div className="sc-bar-f" style={{width:s.w}}/></div>
            </div>
          ))
        )}
      </div>

      <div className="mg">
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          {loading ? (
            <div style={{textAlign: 'center', color: 'var(--ash)', padding: '2rem'}}>
              Cargando capacitaciones...
            </div>
          ) : error ? (
            <div style={{background:'var(--err-bg)',border:'1px solid rgba(220,38,38,.2)',borderRadius:8,padding:'1rem',marginBottom:'1rem',display:'flex',alignItems:'center',gap:10,color:'var(--err)'}}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span style={{fontSize:'.85rem'}}>{error}</span>
            </div>
          ) : trainings.length > 0 ? (
            trainings.map((training) => {
              const statusInfo = getStatusBadge(training.status)
              return (
                <div className="card cap-card" key={training._id}>
                  <div style={{padding:'1.2rem'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'.5rem',marginBottom:'.8rem',flexWrap:'wrap'}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:'.95rem',color:'var(--ink)',marginBottom:'.2rem'}}>{training.title}</div>
                        <div style={{fontSize:'.78rem',color:'var(--ash)'}}>{training.module}</div>
                      </div>
                      <div style={{display:'flex',gap:'.5rem',alignItems:'center',flexShrink:0}}>
                        <span className={`badge ${statusInfo.badge}`}>{training.status}</span>
                        {training.status === 'Completado' && training.score && (
                          <button className="ibtn" title="Descargar certificado" onClick={() => handleDownloadCertificate(training._id)}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                          </button>
                        )}
                        {training.status === 'En proceso' && (
                          <button className="btn btn-sm btn-red" onClick={() => handleContinueTraining(training)}>Continuar</button>
                        )}
                        {training.status === 'Pendiente' && (
                          <button className="btn btn-sm btn-blue" onClick={() => handleContinueTraining(training)}>Iniciar</button>
                        )}
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'1rem',flexWrap:'wrap',marginBottom:'.7rem'}}>
                      <div style={{fontSize:'.73rem',color:'var(--ash)'}}>
                        📅 {training.status === 'Completado' && training.completionDate ?
                          `Completado: ${new Date(training.completionDate).toLocaleDateString('es-ES')}` :
                          training.status === 'En proceso' ?
                          'En curso' :
                          `Programado: ${training.scheduledDate ? new Date(training.scheduledDate).toLocaleDateString('es-ES') : 'Sin fecha'}`}
                      </div>
                      {training.score && <div style={{fontSize:'.73rem',fontWeight:700,color:'var(--ok)'}}>⭐ Calificación: {training.score}/100</div>}
                    </div>
                    <div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'.75rem',marginBottom:'.35rem'}}>
                        <span style={{color:'var(--ash)'}}>Progreso del módulo</span>
                        <span style={{fontWeight:700,color:statusInfo.color}}>{training.progress}%</span>
                      </div>
                      <div className="prog-wrap" style={{height:6}}>
                        <div className="prog-fill" style={{width:`${training.progress}%`,background:statusInfo.color}}/>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div style={{textAlign: 'center', color: 'var(--ash)', padding: '2rem'}}>
              No hay capacitaciones asignadas
            </div>
          )}
        </div>

        <div className="col-r">
          {nextTraining && (
            <div className="card">
              <div className="card-hd"><div className="card-hd-l"><div className="card-ico ico-gold"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg></div><div><div className="card-title">Próxima Capacitación</div></div></div></div>
              <div style={{padding:'1.2rem'}}>
                <div style={{background:'linear-gradient(135deg,var(--blue),#3B82F6)',borderRadius:8,padding:'1.2rem',color:'#fff',marginBottom:'1rem'}}>
                  <div style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.6)',marginBottom:'.4rem'}}>{nextTraining.status === 'En proceso' ? 'EN CURSO' : 'PRÓXIMA'}</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.1rem',fontWeight:700,marginBottom:'.3rem'}}>{nextTraining.title}</div>
                  <div style={{fontSize:'.78rem',color:'rgba(255,255,255,.7)'}}>{nextTraining.module}</div>
                  <div style={{marginTop:'.8rem',paddingTop:'.7rem',borderTop:'1px solid rgba(255,255,255,.2)',display:'flex',justifyContent:'space-between'}}>
                    <div><div style={{fontSize:'.65rem',color:'rgba(255,255,255,.5)',textTransform:'uppercase'}}>Progreso</div><div style={{fontWeight:700,color:'#fff'}}>{nextTraining.progress}%</div></div>
                    <div><div style={{fontSize:'.65rem',color:'rgba(255,255,255,.5)',textTransform:'uppercase'}}>Estado</div><div style={{fontWeight:700,color:'#fff'}}>{nextTraining.status}</div></div>
                  </div>
                </div>
                <button
                  className="btn btn-red"
                  style={{width:'100%',justifyContent:'center'}}
                  onClick={() => handleContinueTraining(nextTraining)}
                >
                  {nextTraining.status === 'En proceso' ? 'Continuar Módulo' : 'Iniciar Capacitación'}
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-hd"><div className="card-hd-l"><div className="card-ico ico-ok"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg></div><div><div className="card-title">Mis Certificados</div></div></div></div>
            <div style={{padding:'.8rem',display:'flex',flexDirection:'column',gap:'.5rem'}}>
              {loading ? (
                <div style={{textAlign: 'center', color: 'var(--ash)', padding: '1rem'}}>
                  Cargando certificados...
                </div>
              ) : certificates.length > 0 ? (
                certificates.map((cert) => (
                  <div
                    key={cert._id}
                    onClick={() => handleDownloadCertificate(cert._id)}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'10px 11px',borderRadius:6,border:'1px solid var(--border)',cursor:'pointer',transition:'all .2s'}}
                    onMouseOver={e=>e.currentTarget.style.borderColor='var(--gold)'}
                    onMouseOut={e=>e.currentTarget.style.borderColor='var(--border)'}
                  >
                    <div style={{width:34,height:34,background:'var(--ok-bg)',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--ok)',flexShrink:0,fontSize:'1.1rem'}}>🏆</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'.82rem',fontWeight:600}}>{cert.title}</div>
                      <div style={{fontSize:'.69rem',color:'var(--ash)'}}>
                        {new Date(cert.issueDate).toLocaleDateString('es-ES')} · {cert.score}/100 · {cert.certificateNumber}
                      </div>
                    </div>
                    <svg fill="none" viewBox="0 0 24 24" stroke="var(--ash-l)" strokeWidth="2" width="14"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  </div>
                ))
              ) : (
                <div style={{textAlign: 'center', color: 'var(--ash)', padding: '1rem'}}>
                  No hay certificados disponibles
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

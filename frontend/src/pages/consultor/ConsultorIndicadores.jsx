import { useState, useEffect } from 'react'
import { toast } from '../../components/Toast'
import { downloadCSV } from '../../utils/downloadHelpers'
import {
  getCollaboratorIndicators,
  getComplianceByClause,
  getFindings,
  getAudits,
} from '../../api/api'

// Sin cifras de relleno: el cumplimiento por cláusula siempre viene del API (documentos + firmas).
const CLAUSULAS_FALLBACK = []

function trendColor(pct, meta) {
  if (pct >= meta) return 'var(--ok)'
  if (pct >= meta * 0.85) return 'var(--warn)'
  return 'var(--err)'
}

export default function ConsultorIndicadores() {
  const [clausulas, setClausulas] = useState(CLAUSULAS_FALLBACK)
  const [kpis, setKpis] = useState(null)
  const [findings, setFindings] = useState([])
  const [audits, setAudits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [indRes, clausRes, findRes, auditRes] = await Promise.allSettled([
          getCollaboratorIndicators(),
          getComplianceByClause(),
          getFindings(),
          getAudits(),
        ])
        if (indRes.status === 'fulfilled' && indRes.value.data?.data?.indicators) {
          setKpis(indRes.value.data.data.indicators)
        }
        if (clausRes.status === 'fulfilled' && clausRes.value.data?.data?.compliance) {
          setClausulas(clausRes.value.data.data.compliance)
        }
        if (findRes.status === 'fulfilled') {
          const list = findRes.value.data?.data?.findings || findRes.value.data?.data || []
          setFindings(Array.isArray(list) ? list : [])
        }
        if (auditRes.status === 'fulfilled') {
          setAudits(auditRes.value.data?.data?.audits || [])
        }
      } catch (err) {
        console.error('[ConsultorIndicadores] Error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // KPIs derivados
  const sgcPct    = kpis?.sgcCompliance?.percentage ?? (clausulas.length > 0 ? Math.round(clausulas.reduce((a,c) => a + c.compliance, 0) / clausulas.length) : 0)
  const sgcLabel  = kpis?.sgcCompliance?.value ?? `${sgcPct}%`
  const docsPct   = kpis?.activeDocuments?.percentage ?? 0
  const docsVal   = kpis?.activeDocuments?.value ?? '—'
  const ncTotal   = findings.length
  const ncCerrado = findings.filter(f => f.status === 'Cerrado').length
  const eficacia  = ncTotal > 0 ? Math.round(ncCerrado / ncTotal * 100) : 0

  // Indicadores por área (derivados de hallazgos reales)
  const areaIndicators = (() => {
    const metas = {
      'Calidad': 90, 'Producción': 85, 'Compras': 80,
      'RRHH': 85, 'SGC': 80, 'Atención': 90,
    }
    const byArea = {}
    findings.forEach(f => {
      const a = f.area || 'Sin área'
      if (!byArea[a]) byArea[a] = { total: 0, resolved: 0 }
      byArea[a].total++
      if (f.status === 'Cerrado') byArea[a].resolved++
    })
    return Object.entries(byArea).map(([area, {total, resolved}]) => {
      const pct = total > 0 ? Math.round(resolved / total * 100) : 100
      const meta = metas[area] || 85
      const badge = pct >= meta ? 'b-ok' : pct >= meta * 0.8 ? 'b-warn' : 'b-err'
      return {
        area, ind: 'Cumplimiento de hallazgos', pct, w: `${pct}%`,
        color: pct >= meta ? '#16A34A' : pct >= meta * 0.8 ? '#F59E0B' : '#DC2626',
        meta: `${meta}%`, trend: pct >= meta ? `↑ OK` : `↓ -${meta - pct}%`,
        tt: pct >= meta ? 'ok' : 'dn', badge,
        estado: pct >= meta ? 'Cumplido' : pct >= meta * 0.8 ? 'En riesgo' : 'No cumplido'
      }
    })
  })()

  function exportIndicadores() {
    const rows = clausulas.map(c => ({
      Indicador: c.label,
      Cumplimiento: `${c.compliance}%`,
      Color: c.compliance >= 90 ? 'Verde' : c.compliance >= 80 ? 'Amarillo' : 'Rojo',
    }))
    downloadCSV(rows, `Indicadores_Consultor_${new Date().toISOString().split('T')[0]}.csv`)
    toast('Reporte de indicadores exportado', 'ok')
  }

  const ReadOnlyBadge = () => (
    <span style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(0,0,0,.06)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 12px',fontSize:'.75rem',fontWeight:600,color:'var(--ash)'}}>
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="14"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>Solo Lectura
    </span>
  )

  return (
    <main className="page">
      <div className="ph">
        <div><h1 className="ph-title">Indicadores <em>SGC</em></h1><p className="ph-sub">Tablero completo de indicadores clave de desempeño del sistema</p></div>
        <div className="ph-actions">
          <ReadOnlyBadge />
          <button className="btn btn-out" onClick={exportIndicadores}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Exportar
          </button>
        </div>
      </div>

      <div className="sg">
        {loading
          ? Array(4).fill(null).map((_,i) => <div key={i} className="sc sc-ok" style={{opacity:.5,minHeight:90}}><div className="sc-lbl">Cargando…</div></div>)
          : [
            { v:'ok', num: sgcLabel, lbl:'Cumplimiento SGC', trend:kpis?.sgcCompliance?.trend || '↑ datos reales', tt:'up', w:`${sgcPct}%`, icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg> },
            { v:'gold', num: String(docsVal), lbl:'Documentos Activos', trend:`${docsPct}%`, tt:'up', w:`${docsPct}%`, icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg> },
            { v:'blue', num: `${eficacia}%`, lbl:'Eficacia de Acciones', trend:`${ncCerrado}/${ncTotal} cerradas`, tt: eficacia >= 80 ? 'up' : 'dn', w:`${eficacia}%`, icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> },
            { v:'warn', num: String(audits.length), lbl:'Auditorías Registradas', trend:`${audits.filter(a=>a.status==='Completada').length} completas`, tt:'n', w:`${audits.length>0?Math.round(audits.filter(a=>a.status==='Completada').length/audits.length*100):0}%`, icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
          ].map((s,i) => (
            <div key={i} className={`sc sc-${s.v}`}>
              <div className="sc-top"><div className="sc-icon">{s.icon}</div><span className={`trend trend-${s.tt}`}>{s.trend}</span></div>
              <div className="sc-num">{s.num}</div><div className="sc-lbl">{s.lbl}</div>
              <div className="sc-bar"><div className="sc-bar-f" style={{width:s.w}}/></div>
            </div>
          ))
        }
      </div>

      <div className="mg">
        <div style={{display:'flex',flexDirection:'column',gap:'1.2rem'}}>
          {/* Indicadores por área */}
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-gold"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div>
                <div><div className="card-title">Indicadores por Área</div><div className="card-sub">Desempeño actual vs meta — datos reales</div></div>
              </div>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Área</th><th>Indicador</th><th>Valor Actual</th><th>Tendencia</th><th>Estado</th></tr></thead>
                <tbody>
                  {loading
                    ? <tr><td colSpan={5} style={{textAlign:'center',color:'var(--ash)',padding:'1.5rem'}}>Cargando indicadores…</td></tr>
                    : areaIndicators.length === 0
                      ? <tr><td colSpan={5} style={{textAlign:'center',color:'var(--ash)',padding:'1.5rem'}}>Sin datos de área disponibles</td></tr>
                      : areaIndicators.map((r,i) => (
                        <tr key={i}>
                          <td style={{fontWeight:700,fontSize:'.8rem'}}>{r.area}</td>
                          <td style={{fontSize:'.82rem'}}>{r.ind}</td>
                          <td>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <div style={{width:80,height:7,background:'var(--surface2)',borderRadius:4,overflow:'hidden'}}>
                                <div style={{width:r.w,height:'100%',background:r.color,borderRadius:4}}/>
                              </div>
                              <span style={{fontSize:'.8rem',fontWeight:700,color:r.color}}>{r.pct}%</span>
                            </div>
                          </td>
                          <td>
                            <span style={{color:r.tt==='ok'?'var(--ok)':'var(--err)',fontSize:'.82rem',fontWeight:700}}>
                              {r.trend}
                            </span>
                          </td>
                          <td><span className={`badge ${r.badge}`}>{r.estado}</span></td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </div>

          {/* Cumplimiento cláusulas ISO */}
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-red"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg></div>
                <div><div className="card-title">Cumplimiento por Cláusula ISO 9001:2015</div></div>
              </div>
            </div>
            <div style={{padding:'1.2rem',display:'flex',flexDirection:'column',gap:'1rem'}}>
              {clausulas.map((c,i) => {
                const nc = c.compliance >= 90 ? 'var(--ok)' : c.compliance >= 80 ? 'var(--gold-d)' : 'var(--warn)'
                return (
                  <div key={i}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'.82rem',marginBottom:'.5rem'}}>
                      <span style={{fontWeight:600}}>{c.label}</span>
                      <span style={{color:nc,fontWeight:700}}>{c.compliance}% logrado</span>
                    </div>
                    <div className="prog-wrap" style={{height:10}}><div className="prog-fill" style={{width:`${c.compliance}%`,background:c.color}}/></div>
                    <div style={{fontSize:'.72rem',color:'var(--ash)',marginTop:'.3rem'}}>
                      {c.totalFindings ? `${c.resolvedFindings}/${c.totalFindings} hallazgos resueltos` : 'Sin hallazgos registrados'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="col-r">
          {/* Comparativo por estado de hallazgos */}
          <div className="card">
            <div className="card-hd"><div className="card-hd-l"><div className="card-ico ico-gold"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg></div><div><div className="card-title">Estado de Hallazgos</div><div className="card-sub">Distribución actual</div></div></div></div>
            <div style={{padding:'1.2rem'}}>
              {[
                { label:'Cerrados', count: ncCerrado, total: ncTotal, color:'var(--ok)' },
                { label:'En proceso', count: findings.filter(f=>f.status==='En Revisión'||f.status==='En Proceso').length, total: ncTotal, color:'#F59E0B' },
                { label:'Abiertos', count: findings.filter(f=>f.status==='Abierto'||f.status==='Pendiente').length, total: ncTotal, color:'var(--red)' },
              ].map((b,i) => (
                <div key={i} style={{marginBottom:'1rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'.78rem',marginBottom:'.4rem'}}>
                    <span style={{fontWeight:600}}>{b.label}</span>
                    <span style={{fontWeight:700,color:b.color}}>{b.count} / {b.total}</span>
                  </div>
                  <div className="prog-wrap"><div className="prog-fill" style={{width:`${b.total>0?Math.round(b.count/b.total*100):0}%`,background:b.color}}/></div>
                </div>
              ))}
              <div style={{textAlign:'center',fontSize:'.73rem',color:'var(--ash)'}}>
                Eficacia de cierre: <span style={{color: eficacia>=80?'var(--ok)':'var(--warn)',fontWeight:700}}>{eficacia}%</span>
              </div>
            </div>
          </div>

          {/* NC abiertas por área */}
          <div className="card">
            <div className="card-hd"><div className="card-hd-l"><div className="card-ico ico-red"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg></div><div><div className="card-title">NC Abiertas por Área</div></div></div></div>
            <div style={{padding:'1rem'}}>
              {(() => {
                const byArea = {}
                findings.filter(f => f.status !== 'Cerrado').forEach(f => {
                  const a = f.area || 'Sin área'
                  byArea[a] = (byArea[a] || 0) + 1
                })
                const entries = Object.entries(byArea)
                const max = Math.max(...entries.map(([,v])=>v), 1)
                return entries.length === 0
                  ? <div style={{color:'var(--ok)',fontSize:'.83rem',textAlign:'center'}}>✓ Sin NC activas</div>
                  : entries.slice(0,5).map(([area,v],i) => (
                    <div key={i} style={{marginBottom:'.9rem'}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'.78rem',marginBottom:'.35rem'}}>
                        <span>{area}</span><span style={{fontWeight:700,color:'var(--err)'}}>{v}</span>
                      </div>
                      <div className="prog-wrap"><div className="prog-fill" style={{width:`${Math.round(v/max*100)}%`,background:'var(--red)'}}/></div>
                    </div>
                  ))
              })()}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

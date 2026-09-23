import { useState, useEffect } from 'react'
import { toast } from '../../components/Toast'
import { downloadCSV, downloadText } from '../../utils/downloadHelpers'
import {
  getComplianceByClause,
  getCollaboratorIndicators,
  getAudits,
  getFindings,
  getRisks,
} from '../../api/api'

// Sin cifras de relleno: el cumplimiento por cláusula siempre viene del API (documentos + firmas).
const CLAUSULAS_FALLBACK = []

export default function ConsultorReportes() {
  const [clausulas, setClausulas] = useState(CLAUSULAS_FALLBACK)
  const [kpis, setKpis] = useState(null)
  const [audits, setAudits] = useState([])
  const [findings, setFindings] = useState([])
  const [risks, setRisks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [clausRes, indRes, auditRes, findRes, riskRes] = await Promise.allSettled([
          getComplianceByClause(),
          getCollaboratorIndicators(),
          getAudits(),
          getFindings(),
          getRisks(),
        ])
        if (clausRes.status === 'fulfilled' && clausRes.value.data?.data?.compliance) {
          setClausulas(clausRes.value.data.data.compliance)
        }
        if (indRes.status === 'fulfilled' && indRes.value.data?.data?.indicators) {
          setKpis(indRes.value.data.data.indicators)
        }
        if (auditRes.status === 'fulfilled') {
          setAudits(auditRes.value.data?.data?.audits || [])
        }
        if (findRes.status === 'fulfilled') {
          const list = findRes.value.data?.data?.findings || findRes.value.data?.data || []
          setFindings(Array.isArray(list) ? list : [])
        }
        if (riskRes.status === 'fulfilled') {
          setRisks(riskRes.value.data?.data || [])
        }
      } catch (err) {
        console.error('[ConsultorReportes] Error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // Métricas derivadas
  const sgcPct   = clausulas.length > 0 ? Math.round(clausulas.reduce((a,c) => a + c.compliance, 0) / clausulas.length) : 0
  const docsVal  = kpis?.activeDocuments?.value ?? '—'
  const ncTotal  = findings.length
  const ncAbiert = findings.filter(f => f.status !== 'Cerrado').length
  const ncCerrad = findings.filter(f => f.status === 'Cerrado').length
  const eficacia = ncTotal > 0 ? Math.round(ncCerrad / ncTotal * 100) : 0

  const reportes = [
    { label:'Reporte de Auditorías', sub:`${audits.length} registradas`, bg:'var(--err-bg)', color:'var(--err)', icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="17"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>, data: () => audits.map(a => ({ Título: a.title, Estado: a.status, Fecha: a.date ? new Date(a.date).toLocaleDateString('es-ES') : '—' })) },
    { label:'Estado de Hallazgos', sub:`${ncTotal} registrados`, bg:'rgba(201,168,76,.1)', color:'var(--gold-d)', icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="17"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>, data: () => findings.map(f => ({ Título: f.title, Área: f.area||'—', Estado: f.status, Severidad: f.severity||'—' })) },
    { label:'Matriz de Riesgos', sub:`${risks.length} riesgos`, bg:'var(--ok-bg)', color:'var(--ok)', icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="17"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>, data: () => risks.map(r => ({ Riesgo: r.riesgo||r.title||'—', Proceso: r.proceso||'—', Nivel: r.nivel||r.level||'—', Estado: r.estado||r.status||'—' })) },
    { label:'Cumplimiento por Cláusula', sub:'ISO 9001:2015', bg:'var(--blue-bg)', color:'var(--blue)', icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="17"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>, data: () => clausulas.map(c => ({ Cláusula: c.label, Cumplimiento: `${c.compliance}%` })) },
    { label:'Reporte de Indicadores KPI', sub:`SGC: ${sgcPct}%`, bg:'rgba(123,30,34,.08)', color:'var(--red)', icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="17"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>, data: () => [{ Indicador:'Cumplimiento SGC', Valor:`${sgcPct}%` },{ Indicador:'Documentos Activos', Valor:String(docsVal) },{ Indicador:'NC Abiertas', Valor:String(ncAbiert) },{ Indicador:'Eficacia de cierre NC', Valor:`${eficacia}%` }] },
  ]

  function downloadReportCard(rpt) {
    const rows = rpt.data()
    if (rows.length === 0) { toast(`Sin datos para ${rpt.label}`, 'n'); return }
    downloadCSV(rows, `${rpt.label.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.csv`)
    toast(`${rpt.label} descargado`, 'ok')
  }

  function exportAnalisisCSV() {
    const csvContent = `ANÁLISIS DE SISTEMA DE GESTIÓN DE CALIDAD - REPORTE CONSULTOR\nFecha: ${new Date().toLocaleDateString('es-ES')}\n\nRESUMEN EJECUTIVO\nCumplimiento SGC,${sgcPct}%\nDocumentos Activos,${docsVal}\nAuditorías,${audits.length}\nNC Activas,${ncAbiert}\nEficacia de cierre,${eficacia}%\n\nINDICADORES POR CLÁUSULA\nCláusula,Cumplimiento\n${clausulas.map(c => `${c.label},${c.compliance}%`).join('\n')}\n\nHALLAZGOS\nTítulo,Área,Estado,Severidad\n${findings.map(f => `${f.title},${f.area||'—'},${f.status},${f.severity||'—'}`).join('\n')}`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `Analisis_SGC_Consultor_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast('Análisis exportado en CSV', 'ok')
  }

  function downloadExecutiveReport() {
    const ncEficacia = ncTotal > 0 ? `${eficacia}%` : 'Sin datos'
    const content = `INFORME EJECUTIVO - SGC\nFecha: ${new Date().toLocaleDateString('es-ES')}\n\nRESUMEN EJECUTIVO\n- Cumplimiento SGC: ${sgcPct}%\n- Documentos Activos: ${docsVal}\n- Auditorías registradas: ${audits.length}\n- Hallazgos activos (NC): ${ncAbiert}\n- Eficacia de cierre NC: ${ncEficacia}\n- Riesgos identificados: ${risks.length}\n\nCUMPLIMIENTO POR CLÁUSULA\n${clausulas.map(c => `${c.label}: ${c.compliance}%`).join('\n')}\n\nHALLAZGOS ACTIVOS (${ncAbiert})\n${findings.filter(f=>f.status!=='Cerrado').slice(0,5).map(f=>`- ${f.title} [${f.area||'—'}] — ${f.status}`).join('\n')}`
    downloadText(content, `Informe_Ejecutivo_Consultor_${new Date().toISOString().split('T')[0]}.txt`)
    toast('Informe ejecutivo descargado', 'ok')
  }

  return (
    <main className="page">
      <div className="ph">
        <div><h1 className="ph-title">Reportes <em>y Análisis</em></h1><p className="ph-sub">Informes del Sistema de Gestión de Calidad disponibles para consulta y descarga</p></div>
        <div className="ph-actions">
          <span style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(0,0,0,.06)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 12px',fontSize:'.75rem',fontWeight:600,color:'var(--ash)'}}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="14"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>Solo Lectura
          </span>
          <button className="btn btn-out" onClick={exportAnalisisCSV}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Exportar Análisis
          </button>
          <button className="btn btn-red" onClick={downloadExecutiveReport} disabled={loading}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>{loading ? 'Cargando…' : 'Informe Ejecutivo'}
          </button>
        </div>
      </div>

      <div className="sg">
        {[
          { v:'ok', num: loading ? '…' : `${sgcPct}%`, lbl:'Cumplimiento SGC', trend:'↑ datos reales', tt:'up', w:`${sgcPct}%`, icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg> },
          { v:'gold', num: loading ? '…' : String(docsVal), lbl:'Docs. Vigentes', trend:'Activos', tt:'up', w:'87%', icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> },
          { v:'blue', num: loading ? '…' : String(audits.length), lbl:'Auditorías', trend:`${audits.filter(a=>a.status==='Completada').length} completas`, tt:'up', w:`${audits.length>0?Math.round(audits.filter(a=>a.status==='Completada').length/audits.length*100):0}%`, icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg> },
          { v:'warn', num: loading ? '…' : String(ncAbiert), lbl:'NC Activas', trend:'Abiertas', tt:'dn', w:`${ncTotal>0?Math.round(ncAbiert/ncTotal*100):0}%`, icon:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg> },
        ].map((s,i) => (
          <div key={i} className={`sc sc-${s.v}`}>
            <div className="sc-top"><div className="sc-icon">{s.icon}</div><span className={`trend trend-${s.tt}`}>{s.trend}</span></div>
            <div className="sc-num">{s.num}</div><div className="sc-lbl">{s.lbl}</div>
            <div className="sc-bar"><div className="sc-bar-f" style={{width:s.w}}/></div>
          </div>
        ))}
      </div>

      <div className="mg">
        <div style={{display:'flex',flexDirection:'column',gap:'1.2rem'}}>
          {/* Cláusulas ISO desde backend */}
          <div className="card">
            <div className="card-hd"><div className="card-hd-l"><div className="card-ico ico-gold"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div><div><div className="card-title">Indicadores por Cláusula ISO 9001:2015</div></div></div></div>
            <div style={{padding:'1.3rem',display:'flex',flexDirection:'column',gap:'1rem'}}>
              {clausulas.map((c,i) => {
                const nc = c.compliance >= 90 ? 'var(--ok)' : c.compliance >= 80 ? 'var(--gold-d)' : 'var(--warn)'
                const color = c.compliance >= 90 ? '#16A34A' : c.compliance >= 80 ? '#F59E0B' : '#DC2626'
                return (
                  <div key={i}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'.82rem',marginBottom:'.4rem',fontWeight:500}}>
                      <span>{c.label}</span><span style={{color:nc,fontWeight:700}}>{c.compliance}%</span>
                    </div>
                    <div className="prog-wrap" style={{height:8}}><div className="prog-fill" style={{width:`${c.compliance}%`,background:color}}/></div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Resumen hallazgos reales */}
          <div className="card">
            <div className="card-hd"><div className="card-hd-l"><div className="card-ico ico-red"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><div><div className="card-title">Estado de No Conformidades</div></div></div></div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Tipo</th><th>Cantidad</th><th>%</th></tr></thead>
                <tbody>
                  {[
                    { tipo:'Abiertas', count: findings.filter(f=>f.status==='Abierto'||f.status==='Pendiente').length, badge:'b-err' },
                    { tipo:'En Revisión', count: findings.filter(f=>f.status==='En Revisión'||f.status==='En Proceso').length, badge:'b-warn' },
                    { tipo:'Cerradas', count: ncCerrad, badge:'b-ok' },
                    { tipo:'Total', count: ncTotal, badge:'b-gray' },
                  ].map((r,i) => (
                    <tr key={i}>
                      <td><span className={`badge ${r.badge}`}>{r.tipo}</span></td>
                      <td style={{fontWeight:700}}>{r.count}</td>
                      <td style={{fontSize:'.8rem',color:'var(--ash)'}}>{ncTotal > 0 ? `${Math.round(r.count/ncTotal*100)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-r">
          {/* Reportes descargables con datos reales */}
          <div className="card">
            <div className="card-hd"><div className="card-hd-l"><div className="card-ico ico-ink"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div><div><div className="card-title">Reportes Disponibles</div><div className="card-sub">Descarga CSV con datos reales</div></div></div></div>
            <div style={{padding:'.7rem',display:'flex',flexDirection:'column',gap:'.5rem'}}>
              {reportes.map((r,i) => (
                <div key={i} onClick={() => downloadReportCard(r)} style={{display:'flex',alignItems:'center',gap:10,padding:11,borderRadius:6,border:'1px solid var(--border)',cursor:'pointer',transition:'all .2s'}}
                  onMouseOver={e=>e.currentTarget.style.borderColor='var(--gold)'}
                  onMouseOut={e=>e.currentTarget.style.borderColor='var(--border)'}>
                  <div style={{width:34,height:34,background:r.bg,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',color:r.color,flexShrink:0}}>{r.icon}</div>
                  <div style={{flex:1}}><div style={{fontSize:'.82rem',fontWeight:600}}>{r.label}</div><div style={{fontSize:'.69rem',color:'var(--ash)'}}>{r.sub}</div></div>
                  <svg fill="none" viewBox="0 0 24 24" stroke="var(--ash-l)" strokeWidth="2" width="14"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                </div>
              ))}
            </div>
          </div>

          {/* Resumen riesgos */}
          <div className="card">
            <div className="card-hd"><div className="card-hd-l"><div className="card-ico ico-gold"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg></div><div><div className="card-title">Resumen de Riesgos</div></div></div></div>
            <div className="al-list">
              {loading
                ? <div style={{padding:'1rem',color:'var(--ash)',fontSize:'.83rem'}}>Cargando…</div>
                : risks.slice(0,3).map((r,i) => {
                  const nivel = r.nivel || r.level || '—'
                  const isHigh = nivel.toLowerCase().includes('alto') || nivel.toLowerCase().includes('crítico')
                  return (
                    <div key={i} className={`al ${isHigh ? 'al-err' : 'al-warn'}`}>
                      <div className="al-ico"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="15"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg></div>
                      <div><div className="al-ttl">{r.riesgo || r.title || '—'}</div><div className="al-sub">Nivel {nivel} · {r.estado || r.status || '—'}</div></div>
                    </div>
                  )
                })
              }
              {!loading && risks.length === 0 && (
                <div style={{padding:'1rem',color:'var(--ok)',fontSize:'.83rem',textAlign:'center'}}>✓ Sin riesgos registrados</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

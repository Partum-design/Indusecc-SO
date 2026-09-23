import { useState, useEffect } from 'react'
import { toast } from '../../components/Toast'
import { getComplianceReport, getDocuments, getAudits, getFindings, getComplianceByClause } from '../../api/api'

export default function Reportes() {
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState({
    cumplimiento: 0,
    docsVigentes: 0,
    auditorias: 0,
    ncActivas: 0,
    clausulas: [
      { label: 'Cl. 4 — Contexto de la Organización', pct: 0, color: '#16A34A', numColor: 'var(--ok)' },
      { label: 'Cl. 5 — Liderazgo', pct: 0, color: '#16A34A', numColor: 'var(--ok)' },
      { label: 'Cl. 6 — Planificación', pct: 0, color: 'var(--gold)', numColor: 'var(--gold-d)' },
      { label: 'Cl. 7 — Apoyo', pct: 0, color: 'var(--gold)', numColor: 'var(--gold-d)' },
      { label: 'Cl. 8 — Operación', pct: 0, color: '#F59E0B', numColor: 'var(--warn)' },
      { label: 'Cl. 9 — Evaluación del Desempeño', pct: 0, color: 'var(--gold)', numColor: 'var(--gold-d)' },
      { label: 'Cl. 10 — Mejora', pct: 0, color: '#F59E0B', numColor: 'var(--warn)' },
    ],
    nc: [
      { periodo: 'Q1 2026', abiertas: 0, cerradas: 0, badge: 'b-gray', eficacia: '0%', aColor: 'var(--warn)', cColor: 'var(--ok)' },
    ]
  })

  useEffect(() => {
    async function fetchReport() {
      try {
        const [compRes, docsRes, auditsRes, findingsRes, clauseMetricsRes] = await Promise.all([
          getComplianceReport(),
          getDocuments({ limit: 500 }),
          getAudits(),
          getFindings(),
          getComplianceByClause()
        ])

        const compliance = compRes.data?.data?.completion?.overall || 0
        const docs = docsRes.data?.data?.documents || docsRes.data?.data || []
        const audits = auditsRes.data?.data?.audits || auditsRes.data?.data || []
        const findings = findingsRes.data?.data?.findings || findingsRes.data?.data || []
        const clauseMetrics = clauseMetricsRes.data?.data?.compliance || []

        // Mapear cláusulas reales si existen en el API
        const updatedClausulas = reportData.clausulas.map(c => {
          const match = clauseMetrics.find(m => c.label.includes(`Cl. ${m.clause}`))
          if (!match) return c
          const pct = match.compliance
          return {
            ...c,
            pct,
            color: pct >= 90 ? '#16A34A' : pct >= 50 ? '#F59E0B' : '#DC2626',
            numColor: pct >= 90 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--err)'
          }
        })

        setReportData({
          cumplimiento: compliance,
          docsVigentes: docs.filter(d => d.status === 'vigente').length,
          auditorias: audits.length,
          ncActivas: findings.filter(f => f.status !== 'Cerrado').length,
          clausulas: updatedClausulas,
          nc: [
            { periodo: 'Q1 2026', abiertas: findings.length, cerradas: findings.filter(f => f.status === 'Cerrado').length, badge: 'b-gray', eficacia: `${Math.round((findings.filter(f => f.status === 'Cerrado').length / (findings.length || 1)) * 100)}%`, aColor: 'var(--warn)', cColor: 'var(--ok)' },
          ]
        })
      } catch (err) {
        console.error('Error fetching report:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function exportToCSV() {
    const csvContent = `REPORTE DEL SISTEMA DE GESTIÓN DE CALIDAD\nFecha: ${new Date().toLocaleDateString('es-ES')}\n\nRESUMEN EJECUTIVO\nCumplimiento SGC,${reportData.cumplimiento}%\nDocumentos Vigentes,${reportData.docsVigentes}\nAuditorías 2026,${reportData.auditorias}\nNC Activas,${reportData.ncActivas}\n\nINDICADORES POR CLÁUSULA\nCláusula,Cumplimiento\n${reportData.clausulas.map(c => `${c.label},${c.pct}%`).join('\n')}\n\nHISTÓRICO DE NO CONFORMIDADES\nPeríodo,NC Abiertas,NC Cerradas,Eficacia\n${reportData.nc.map(n => `${n.periodo},${n.abiertas},${n.cerradas},${n.eficacia}`).join('\n')}`
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `Reporte_SGC_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast('Reporte exportado en CSV', 'ok')
  }

  return (
    <main className="page">
      <div className="ph">
        <div>
          <h1 className="ph-title">Reportes <em>y Análisis</em></h1>
          <p className="ph-sub">Indicadores clave del Sistema de Gestión de Calidad</p>
        </div>
        <div className="ph-actions">
          <button className="btn btn-out" onClick={exportToCSV}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Exportar CSV
          </button>
          <button className="btn btn-red" onClick={() => toast('Generando reporte…', 'n')}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>Generar Reporte
          </button>
        </div>
      </div>

      <div className="sg">
        {[
          { v: 'ok', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>, iconTrend: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" width="10"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>, trend: ' +3%', tt: 'up', num: `${reportData.cumplimiento}%`, lbl: 'Cumplimiento SGC', w: `${reportData.cumplimiento}%` },
          { v: 'gold', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>, iconTrend: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" width="10"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>, trend: ' 87%', tt: 'up', num: reportData.docsVigentes, lbl: 'Docs. Vigentes', w: '87%' },
          { v: 'blue', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>, trend: `${reportData.auditorias} de ${reportData.auditorias}`, tt: 'up', num: reportData.auditorias, lbl: 'Auditorías 2026', w: '20%' },
          { v: 'warn', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>, trend: 'Abiertas', tt: 'dn', num: reportData.ncActivas, lbl: 'NC Activas', w: '35%' },
        ].map((s, i) => (
          <div key={i} className={`sc sc-${s.v}`}>
            <div className="sc-top"><div className="sc-icon">{s.icon}</div><span className={`trend trend-${s.tt}`}>{s.iconTrend}{s.trend}</span></div>
            <div className="sc-num">{s.num}</div><div className="sc-lbl">{s.lbl}</div>
            <div className="sc-bar"><div className="sc-bar-f" style={{ width: s.w }} /></div>
          </div>
        ))}
      </div>

      <div className="mg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* Indicadores por cláusula */}
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-gold"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div>
                <div><div className="card-title">Indicadores de Cumplimiento por Cláusula ISO</div></div>
              </div>
            </div>
            <div style={{ padding: '1.3rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {reportData.clausulas.map((c, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', marginBottom: '.4rem', fontWeight: 500 }}>
                    <span>{c.label}</span><span style={{ color: c.numColor, fontWeight: 700 }}>{c.pct}%</span>
                  </div>
                  <div className="prog-wrap" style={{ height: 8 }}>
                    <div className="prog-fill" style={{ width: `${c.pct}%`, background: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico NC */}
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-red"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
                <div><div className="card-title">Histórico de No Conformidades</div></div>
              </div>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Período</th><th>NC Abiertas</th><th>NC Cerradas</th><th>Eficacia</th></tr></thead>
                <tbody>
                  {reportData.nc.map((r, i) => (
                    <tr key={i}>
                      <td>{r.periodo}</td>
                      <td style={{ fontWeight: 700, color: r.aColor }}>{r.abiertas}</td>
                      <td style={{ fontWeight: 700, color: r.cColor }}>{r.cerradas}</td>
                      <td><span className={`badge ${r.badge}`}>{r.eficacia}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-r">
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-ink"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div>
                <div><div className="card-title">Reportes Disponibles</div></div>
              </div>
            </div>
            <div style={{ padding: '.7rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {[
                { label: 'Reporte de Auditoría', sub: 'Estado completo de auditorías', bg: 'var(--err-bg)', color: 'var(--err)' },
                { label: 'Estado Documental', sub: 'Todos los documentos y vigencias', bg: 'rgba(201,168,76,.1)', color: 'var(--gold-d)' },
                { label: 'Acciones Correctivas', sub: 'Eficacia y seguimiento de ACPM', bg: 'var(--ok-bg)', color: 'var(--ok)' },
                { label: 'Informe de Dirección', sub: 'Revisión anual por la alta dirección', bg: 'var(--blue-bg)', color: 'var(--blue)' },
              ].map((r, i) => (
                <div key={i} onClick={() => toast(`Generando: ${r.label}`, 'n')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 11px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all .2s' }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                  <div style={{ width: 34, height: 34, background: r.bg, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: r.color, flexShrink: 0 }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="17"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '.82rem', fontWeight: 600 }}>{r.label}</div>
                    <div style={{ fontSize: '.69rem', color: 'var(--ash)' }}>{r.sub}</div>
                  </div>
                  <svg fill="none" viewBox="0 0 24 24" stroke="var(--ash-l)" strokeWidth="2" width="14"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

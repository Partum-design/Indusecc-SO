import { useState, useEffect } from 'react'
import { getDocuments, getAudits, getFindings, getComplianceReport, getCalendars } from '../../api/api'
import { STATUS_META, downloadDocumentFile, errorMessage } from '../../utils/documents'
import { useNavigate } from 'react-router-dom'
import { toast } from '../../components/Toast'

const EyeIcon = () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
const DownloadIcon = () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
const RefreshIcon = () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
const DocIcon = () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    docsCount: 0,
    auditsCount: 0,
    findingsCount: 0,
    compliancePct: 0,
    requirements: { completed: 0, total: 0 },
    clauseBars: [],
    alerts: [],
    recentDocs: [],
    recentActivity: []
  })

  function downloadCsv(rows, filename) {
    const headers = Object.keys(rows[0] || {})
    const csv = [headers.join(','), ...rows.map(row => headers.map(key => JSON.stringify(row[key] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  function exportDashboardData() {
    const rows = [
      { Métrica: 'Documentos', Valor: data.docsCount },
      { Métrica: 'Auditorías', Valor: data.auditsCount },
      { Métrica: 'Hallazgos', Valor: data.findingsCount },
      { Métrica: 'Cumplimiento', Valor: `${data.compliancePct}%` },
      { Métrica: 'Eventos Calendario', Valor: data.recentActivity.length }
    ]
    downloadCsv(rows, `Dashboard_Resumen_${new Date().toISOString().split('T')[0]}.csv`)
    toast('Resumen del panel exportado en CSV', 'ok')
  }

  function handleViewDoc(doc) {
    navigate(`/admin/documentos-iso?doc=${doc.id}`)
  }

  async function handleDownloadDoc(doc) {
    try {
      await downloadDocumentFile(doc.id)
      toast(`Descargando "${doc.name}"`, 'ok')
    } catch (err) {
      toast(errorMessage(err, 'No se pudo descargar el documento'), 'err')
    }
  }

  // Próximos Vencimientos (Dinamizados)
  const [vencimientos, setVencimientos] = useState([])

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [docsRes, auditsRes, findingsRes, complianceRes, calendarRes] = await Promise.all([
          getDocuments({ limit: 500 }),
          getAudits(),
          getFindings(),
          getComplianceReport(),
          getCalendars()
        ])

        const docs = docsRes.data?.data?.documents || docsRes.data?.data || []
        const audits = auditsRes.data?.data?.audits || auditsRes.data?.data || []
        const findings = findingsRes.data?.data?.findings || findingsRes.data?.data || []
        const report = complianceRes.data?.data
        const compliance = report?.completion?.overall || 0
        const now = new Date()
        const calendar = calendarRes.data?.data?.calendars || calendarRes.data?.data || []

        // Procesar vencimientos desde Documentos con fecha y Calendario
        const docVenc = docs
          .filter(d => d.expiryDate)
          .map(d => ({
            day: new Date(d.expiryDate).getUTCDate().toString(),
            mon: new Date(d.expiryDate).toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
            title: d.title || d.originalName,
            sub: `Vencimiento de ${d.code}`,
            badge: Math.round((new Date(d.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)) + 'd',
            badgeCls: 'b-err',
            numColor: 'var(--err)',
            ts: new Date(d.expiryDate).getTime()
          }))

        const calVenc = calendar
          .filter(e => e.type === 'Vencimiento' || e.type === 'Auditoría')
          .map(e => ({
            day: new Date(e.date).getUTCDate().toString(),
            mon: new Date(e.date).toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
            title: e.title,
            sub: e.type,
            badge: Math.round((new Date(e.date) - new Date()) / (1000 * 60 * 60 * 24)) + 'd',
            badgeCls: 'b-warn',
            numColor: 'var(--warn)',
            ts: new Date(e.date).getTime()
          }))

        setVencimientos([...docVenc, ...calVenc].filter(v => v.ts >= new Date().setHours(0,0,0,0)).sort((a,b) => a.ts - b.ts).slice(0, 3))

        // Alertas reales: vencidos, por vencer, firmas pendientes de este usuario y hallazgos críticos abiertos.
        const alerts = []
        docs.filter(d => d.status === 'vencido').slice(0, 3).forEach(d => alerts.push({ cls: 'al-err', title: `${d.code} vencido`, sub: d.title, to: `/admin/documentos-iso?doc=${d.id}` }))
        docs.filter(d => d.expiringSoon).slice(0, 3).forEach(d => alerts.push({ cls: 'al-warn', title: `${d.code} por vencer`, sub: `Vence el ${new Date(d.expiryDate).toLocaleDateString('es-MX')}`, to: `/admin/documentos-iso?doc=${d.id}` }))
        const pendingForMe = docs.filter(d => d.signatures?.pendingForMe)
        if (pendingForMe.length) alerts.push({ cls: 'al-warn', title: `${pendingForMe.length} documento(s) esperan tu firma`, sub: 'Abrir Documentos ISO', to: '/admin/documentos-iso' })
        const openCritical = findings.filter(f => ['Alta', 'Crítica'].includes(f.severity) && f.status !== 'Cerrado')
        if (openCritical.length) alerts.push({ cls: 'al-err', title: `${openCritical.length} hallazgo(s) de severidad alta abiertos`, sub: 'Revisar en Auditorías', to: '/admin/auditorias' })

        setData({
          docsCount: docs.length,
          auditsCount: audits.length,
          findingsCount: findings.length,
          compliancePct: compliance,
          requirements: { completed: report?.requirements?.completed || 0, total: report?.requirements?.total || 0 },
          clauseBars: (report?.clauses || []).map(c => ({ label: `Cl. ${c.number}`, title: c.title, h: c.completion, docs: c.documents })),
          alerts,
          recentDocs: docs.slice(0, 3).map(d => {
            const meta = STATUS_META[d.status] || STATUS_META.vigente
            return {
              id: d.id,
              name: d.title || d.originalName,
              code: d.code || 'DOC-001',
              version: d.version || 'v.01',
              status: meta.label,
              date: d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('es-MX') : 'Reciente',
              badgeCls: meta.cls,
              isExpired: d.status === 'vencido'
            }
          }),
          recentActivity: [
            ...docs.slice(0, 2).map(d => ({
              dot: 'dot-ok',
              icon: <DocIcon />,
              msg: `Documento ${d.code}: ${d.title}`,
              time: `${d.uploadedByName || 'Usuario'} · ${new Date(d.createdAt).toLocaleDateString('es-MX')}`
            })),
            ...findings.slice(0, 2).map(f => ({
              dot: 'dot-warn',
              icon: <EyeIcon/>,
              msg: `Nuevo hallazgo: ${f.title}`,
              time: new Date(f.createdAt).toLocaleDateString('es-MX')
            }))
          ]
        })
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  const stats = [
    { cls: 'sc-gold', to: '/admin/documentos-iso', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>, iconTrend: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" width="10"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>, trend: 'En sistema', trendCls: 'trend-up', num: data.docsCount, lbl: 'Docs. en Sistema', bar: 100 },
    { cls: 'sc-blue', to: '/admin/auditorias', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>, iconTrend: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" width="10"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>, trend: 'Activas', trendCls: 'trend-up', num: data.auditsCount, lbl: 'Auditorías', bar: 70 },
    { cls: 'sc-warn', to: '/admin/mejora-continua', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>, iconTrend: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" width="10"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>, trend: 'Abiertos', trendCls: 'trend-dn', num: data.findingsCount, lbl: 'Hallazgos / NC', bar: 30 },
    { cls: 'sc-ok', to: '/admin/reportes', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>, iconTrend: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" width="10"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>, trend: 'ISO', trendCls: 'trend-up', num: `${data.compliancePct}%`, lbl: 'Cumplimiento SGC', bar: data.compliancePct },
  ]

  const recentDocs = data.recentDocs
  const activity = data.recentActivity

  return (
    <main className="page">
      <div className="ph">
        <div>
          <h1 className="ph-title">Resumen del <em>Sistema</em></h1>
          <p className="ph-sub">ISO 9001:2015 — {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="ph-actions">
          <button className="btn btn-out" onClick={exportDashboardData}><DownloadIcon /> Exportar</button>
          <button className="btn btn-red" onClick={() => navigate('/admin/documentos-iso')}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Subir Documento
          </button>
        </div>
      </div>

      <div className="sg">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', gridColumn: '1 / -1', color: 'var(--ash)' }}>Cargando estadísticas...</div>
        ) : stats.map((s, i) => (
          <div key={i} className={`sc ${s.cls}`} onClick={() => navigate(s.to)} style={{ cursor: 'pointer' }}>
            <div className="sc-top">
              <div className="sc-icon">{s.icon}</div>
              <span className={`trend ${s.trendCls}`}>{s.iconTrend} {s.trend}</span>
            </div>
            <div className="sc-num">{s.num}</div>
            <div className="sc-lbl">{s.lbl}</div>
            <div className="sc-bar"><div className="sc-bar-f" style={{ width: `${s.bar}%` }} /></div>
          </div>
        ))}
      </div>

      <div className="mg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* Modificaciones recientes */}
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-gold"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
                <div><div className="card-title">Modificaciones Recientes</div><div className="card-sub">Últimos 30 días</div></div>
              </div>
              <span className="card-link" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/documentos-iso')}>Ver todos →</span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Documento</th><th>Versión</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
                <tbody>
                  {recentDocs.map((d, i) => (
                    <tr key={i}>
                      <td>
                        <div className="dn">
                          <div className="dn-ico"><DocIcon /></div>
                          <div><div className="dn-title">{d.name}</div><div className="dn-code">{d.code}</div></div>
                        </div>
                      </td>
                      <td style={{ fontSize: '.8rem', color: 'var(--ash)', fontWeight: 600 }}>{d.version}</td>
                      <td><span className={`badge ${d.badgeCls}`}>{d.status}</span></td>
                      <td style={{ fontSize: '.78rem', color: 'var(--ash)' }}>{d.date}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '.3rem' }}>
                          <button className="ibtn" onClick={() => handleViewDoc(d)}><EyeIcon /></button>
                          {d.isExpired
                            ? <button className="ibtn ibtn-red" onClick={() => handleDownloadDoc(d)}><RefreshIcon /></button>
                            : <button className="ibtn" onClick={() => handleDownloadDoc(d)}><DownloadIcon /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actividad reciente */}
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-ink"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
                <div><div className="card-title">Actividad Reciente</div></div>
              </div>
            </div>
            <div className="act-list">
              {activity.map((a, i) => (
                <div key={i} className="act-i">
                  <div className={`act-dot ${a.dot}`}>{a.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div className="act-msg">{a.msg}</div>
                    <div className="act-time">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfica cumplimiento mensual */}
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-ok"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div>
                <div><div className="card-title">Cumplimiento por Cláusula ISO</div><div className="card-sub">Se actualiza solo con cada documento y firma</div></div>
              </div>
            </div>
            <div style={{ padding: '1.2rem 1.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100, marginBottom: '.7rem' }}>
                {data.clauseBars.map((b) => (
                  <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: '100%', borderRadius: '4px 4px 0 0', height: Math.max(b.h, 3),
                      background: b.h >= 90 ? 'var(--ok)' : b.h >= 50 ? '#F59E0B' : 'var(--red)',
                      opacity: b.h === 0 ? 0.25 : 0.85,
                    }} title={`${b.title}: ${b.h}% · ${b.docs} documento(s)`} />
                    <div style={{ fontSize: '.65rem', color: 'var(--ash)', fontWeight: 600 }}>{b.label}</div>
                  </div>
                ))}
                {data.clauseBars.length === 0 && <div style={{ fontSize: '.8rem', color: 'var(--ash)' }}>Cargando…</div>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '.73rem', color: 'var(--ash)' }}>{data.requirements.completed} de {data.requirements.total} requisitos completos (documento vigente y firmado)</div>
                <div style={{ fontSize: '.73rem', fontWeight: 700, color: 'var(--ok)' }}>{data.compliancePct}% actual</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="col-r">
          {/* Alertas */}
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-red"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg></div>
                <div><div className="card-title">Alertas Activas</div></div>
              </div>
              <span style={{ fontSize: '.68rem', background: data.alerts.length ? 'var(--err-bg)' : 'var(--ok-bg)', color: data.alerts.length ? 'var(--err)' : 'var(--ok)', fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>{data.alerts.length}</span>
            </div>
            <div className="al-list">
              {data.alerts.length === 0 && <div style={{ padding: '1rem', fontSize: '.8rem', color: 'var(--ash)' }}>Sin alertas activas. Todo en orden.</div>}
              {data.alerts.map((a, i) => (
                <div key={i} className={`al ${a.cls}`} style={{ cursor: 'pointer' }} onClick={() => navigate(a.to)}>
                  <div className="al-ico"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="15"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg></div>
                  <div><div className="al-ttl">{a.title}</div><div className="al-sub">{a.sub}</div></div>
                </div>
              ))}
            </div>
          </div>

          {/* Accesos rápidos */}
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-ink"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></div>
                <div><div className="card-title">Accesos Rápidos</div></div>
              </div>
            </div>
            <div className="qg">
              <button className="qbtn qbtn-r" onClick={() => navigate('/admin/documentos-iso')}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                Subir Doc.
              </button>
              <button className="qbtn" onClick={() => navigate('/admin/documentos-iso')}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--gold-d)' }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                Documentos
              </button>
              <button className="qbtn" onClick={() => navigate('/admin/auditorias')}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--gold-d)' }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                Auditorías
              </button>
              <button className="qbtn" onClick={() => navigate('/admin/reportes')}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--gold-d)' }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Reporte
              </button>
            </div>
          </div>

          {/* Próximos vencimientos */}
          <div className="card">
            <div className="card-hd">
              <div className="card-hd-l">
                <div className="card-ico ico-gold">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div><div className="card-title">Próximos Vencimientos</div><div className="card-sub">Siguientes 60 días</div></div>
              </div>
            </div>
            <div style={{ padding: '.5rem' }}>
              {vencimientos.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 8px', borderRadius: 6, cursor: 'pointer', transition: 'background .15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 36, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 900, color: v.numColor, lineHeight: 1 }}>{v.day}</div>
                    <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ash)' }}>{v.mon}</div>
                  </div>
                  <div style={{ width: 1, height: 30, background: 'var(--border)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--ink)' }}>{v.title}</div>
                    <div style={{ fontSize: '.68rem', color: 'var(--ash)' }}>{v.sub}</div>
                  </div>
                  <span className={`badge ${v.badgeCls}`}>{v.badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </main>
  )
}

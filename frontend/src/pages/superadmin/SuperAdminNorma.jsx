import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../../components/Toast'
import ClauseTree from '../../components/documents/ClauseTree'
import { exportIsoCsv, getDocuments, getIsoTree } from '../../api/api'
import { downloadBlob } from '../../utils/downloadHelpers'
import { errorMessage } from '../../utils/documents'

// Nodos de la norma ISO 9001:2015: el avance NO se edita a mano, se calcula con los documentos
// vinculados a cada requisito y sus firmas (ver "Documentos ISO").
export default function SuperAdminNorma() {
  const navigate = useNavigate()
  const [tree, setTree] = useState([])
  const [summary, setSummary] = useState(null)
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [treeRes, docsRes] = await Promise.all([getIsoTree(), getDocuments({ limit: 500 })])
      setTree(treeRes.data.data.norm.clauses)
      setSummary(treeRes.data.data.norm.summary)
      setDocs(docsRes.data.data.documents)
    } catch (err) {
      setError(errorMessage(err, 'No se pudo cargar la norma'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const docsByClause = useMemo(() => {
    const map = new Map()
    docs.forEach(doc => {
      if (!doc.clause) return
      if (!map.has(doc.clause)) map.set(doc.clause, [])
      map.get(doc.clause).push(doc)
    })
    return map
  }, [docs])

  const exportCsv = async () => {
    try {
      const res = await exportIsoCsv('all')
      downloadBlob(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }), `ISO_9001_Reporte_${new Date().toISOString().slice(0, 10)}.csv`)
      toast('Reporte exportado exitosamente', 'ok')
    } catch (err) {
      toast(errorMessage(err, 'No se pudo exportar'), 'err')
    }
  }

  const cards = summary ? [
    { cls: 'sc-gold', num: `${summary.overall}%`, lbl: 'Cumplimiento global', sub: `${summary.requirements} requisitos de la norma`, bar: summary.overall },
    { cls: 'sc-ok', num: summary.requirementsCompleted, lbl: 'Requisitos completos', sub: 'documento vigente y firmado', bar: summary.requirements ? Math.round((summary.requirementsCompleted / summary.requirements) * 100) : 0 },
    { cls: 'sc-warn', num: summary.requirementsInProgress, lbl: 'En progreso', sub: 'con documento, falta firma', bar: summary.requirements ? Math.round((summary.requirementsInProgress / summary.requirements) * 100) : 0 },
    { cls: 'sc-red', num: summary.requirementsPending, lbl: 'Sin evidencia', sub: 'sin documentos vinculados', bar: summary.requirements ? Math.round((summary.requirementsPending / summary.requirements) * 100) : 0 },
  ] : []

  return (
    <main className="page">
      <div className="ph">
        <div>
          <h1 className="ph-title">Nodos de la <em>Norma ISO 9001:2015</em></h1>
          <p className="ph-sub">Cláusulas 4 a 10 con todos sus requisitos · el avance se calcula solo con los documentos y firmas</p>
        </div>
        <div className="ph-actions">
          <button className="btn btn-out" onClick={exportCsv} disabled={loading}>Exportar CSV</button>
          <button className="btn btn-red" onClick={() => navigate('/superadmin/documentos')}>Ir a Documentos ISO</button>
        </div>
      </div>

      {error && <div className="dm-error" role="alert" style={{ marginBottom: '1rem' }}>{error} <button className="btn btn-out btn-sm" style={{ marginLeft: 8 }} onClick={load}>Reintentar</button></div>}

      {loading ? (
        <div className="dm-loading"><div className="dm-spinner" /><span>Cargando la norma…</span></div>
      ) : (
        <>
          <div className="sg">
            {cards.map(card => (
              <div key={card.lbl} className={`sc ${card.cls}`}>
                <div className="sc-num">{card.num}</div>
                <div className="sc-lbl">{card.lbl}</div>
                <div style={{ fontSize: '.72rem', color: 'var(--ash)', marginTop: 4 }}>{card.sub}</div>
                <div className="sc-bar"><div className="sc-bar-f" style={{ width: `${card.bar}%` }} /></div>
              </div>
            ))}
          </div>

          <div className="dm-legend">
            <strong>Regla de cálculo:</strong>
            <span><i style={{ background: '#9CA3AF' }} />Sin documentos = 0 %</span>
            <span><i style={{ background: '#F59E0B' }} />Documento cargado = 50 %</span>
            <span><i style={{ background: '#16A34A' }} />Documento vigente y firmado = 100 %</span>
          </div>

          <ClauseTree tree={tree} docsByClause={docsByClause} readOnly onUpload={() => {}}
            onOpenDoc={(doc) => navigate(`/superadmin/documentos?doc=${doc.id}`)} />
        </>
      )}
    </main>
  )
}

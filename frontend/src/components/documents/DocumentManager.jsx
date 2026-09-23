import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import { toast } from '../Toast'
import { deleteDocument, exportIsoCsv, getDocuments, getDocumentStats } from '../../api/api'
import { downloadBlob } from '../../utils/downloadHelpers'
import { DOC_TYPES, STATUS_META, downloadDocumentFile, errorMessage, fmtDate } from '../../utils/documents'
import ClauseTree from './ClauseTree'
import UploadModal from './UploadModal'
import DocumentViewer from './DocumentViewer'
import SignModal from './SignModal'
import RequestSignaturesModal from './RequestSignaturesModal'

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN']

const Icon = ({ d, size = 14 }) => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width={size} height={size}><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
)
const ICONS = {
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  pen: 'M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.94L6 18l1.232-4.414A4 4 0 018.172 12.172z',
  plus: 'M12 4v16m8-8H4',
  file: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  badge: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
}

// Pantalla única de gestión documental ISO 9001:2015 para todos los roles.
// `role` solo cambia el texto; los permisos reales los aplica el backend (autor o administrador).
export default function DocumentManager({ title = 'Documentos', subtitle }) {
  const { user } = useContext(AuthContext)
  const [searchParams, setSearchParams] = useSearchParams()

  const [docs, setDocs] = useState([])
  const [stats, setStats] = useState(null)
  const [iso, setIso] = useState(null)
  const [tree, setTree] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [view, setView] = useState('clausulas')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterType, setFilterType] = useState('todos')
  const [filterClause, setFilterClause] = useState('todas')

  const [uploadFor, setUploadFor] = useState(null) // { clause } | null
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null) // id del documento abierto
  const [signing, setSigning] = useState(null)
  const [requesting, setRequesting] = useState(null) // { doc, alreadySigned }

  const isAdmin = ADMIN_ROLES.includes(user?.role)
  const canUpload = user?.role !== 'CONSULTOR' // el consultor es de solo lectura: ve, descarga y firma
  const canManage = useCallback((doc) => isAdmin || doc.uploadedBy === user?.id, [isAdmin, user?.id])

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const [docsRes, statsRes] = await Promise.all([getDocuments({ limit: 500 }), getDocumentStats()])
      setDocs(docsRes.data.data.documents)
      setStats(statsRes.data.data.stats)
      setIso(statsRes.data.data.iso)
      setTree(statsRes.data.data.tree)
    } catch (err) {
      setError(errorMessage(err, 'No se pudieron cargar los documentos'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Enlaces desde notificaciones: ?doc=<id>[&firmar=1]
  const deepDocId = searchParams.get('doc')
  const deepSign = searchParams.get('firmar') === '1'
  useEffect(() => {
    if (!deepDocId || loading) return
    const target = docs.find(d => d.id === deepDocId)
    if (target) {
      setViewing(target.id)
      if (deepSign && !target.signatures.signedByMe && ['vigente', 'en_revision'].includes(target.status)) setSigning(target)
    } else {
      toast('Ese documento ya no existe o fue eliminado', 'warn')
    }
    setSearchParams({}, { replace: true })
  }, [deepDocId, deepSign, loading, docs, setSearchParams])

  const viewingDoc = useMemo(() => docs.find(d => d.id === viewing) || null, [docs, viewing])

  const docsByClause = useMemo(() => {
    const map = new Map()
    docs.forEach(doc => {
      if (!doc.clause) return
      if (!map.has(doc.clause)) map.set(doc.clause, [])
      map.get(doc.clause).push(doc)
    })
    return map
  }, [docs])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return docs.filter(d => {
      if (filterStatus === 'porfirmar' && !d.signatures.pendingForMe) return false
      if (filterStatus === 'porvencer' && !d.expiringSoon) return false
      if (filterStatus === 'sinfirma' && d.signatures.signed > 0) return false
      if (['vigente', 'en_revision', 'vencido', 'archivado'].includes(filterStatus) && d.status !== filterStatus) return false
      if (filterType !== 'todos' && d.type !== filterType) return false
      if (filterClause !== 'todas' && !(d.clause === filterClause || (d.clause || '').startsWith(`${filterClause}.`))) return false
      if (!term) return true
      return [d.code, d.title, d.originalName, d.responsible, d.clause].some(v => String(v || '').toLowerCase().includes(term))
    })
  }, [docs, search, filterStatus, filterType, filterClause])

  const openDoc = (doc) => setViewing(doc.id)

  const handleSaved = async () => {
    setUploadFor(null)
    setEditing(null)
    await load({ silent: true })
  }

  const handleDelete = async (doc) => {
    try {
      await deleteDocument(doc.id)
      toast(`Documento ${doc.code} eliminado`, 'ok')
      setViewing(null)
      await load({ silent: true })
    } catch (err) {
      toast(errorMessage(err, 'No se pudo eliminar el documento'), 'err')
    }
  }

  const exportCompliance = async () => {
    try {
      const res = await exportIsoCsv('all')
      downloadBlob(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }), `cumplimiento_ISO9001_${new Date().toISOString().slice(0, 10)}.csv`)
      toast('Cumplimiento ISO exportado en CSV', 'ok')
    } catch (err) {
      toast(errorMessage(err, 'No se pudo exportar'), 'err')
    }
  }

  const pending = stats?.pendientesParaMi || 0
  const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0)

  const statCards = stats && iso ? [
    { cls: 'sc-blue', icon: ICONS.file, num: stats.total, lbl: 'Documentos', sub: `${stats.enRevision} en revisión`, bar: 100 },
    { cls: 'sc-ok', icon: ICONS.check, num: stats.vigentes, lbl: 'Vigentes', sub: stats.porVencer ? `${stats.porVencer} por vencer` : `${stats.vencidos} vencido(s)`, bar: pct(stats.vigentes, stats.total) },
    { cls: 'sc-warn', icon: ICONS.pen, num: stats.firmados, lbl: 'Firmados', sub: `${stats.firmasPendientes} firma(s) pendiente(s)`, bar: pct(stats.firmados, stats.total) },
    { cls: 'sc-gold', icon: ICONS.badge, num: `${iso.overall}%`, lbl: 'Cumplimiento ISO 9001', sub: `${iso.requirementsCompleted}/${iso.requirements} requisitos completos`, bar: iso.overall },
  ] : []

  return (
    <main className="page">
      <div className="ph">
        <div>
          <h1 className="ph-title">{title} <em>ISO 9001:2015</em></h1>
          <p className="ph-sub">{subtitle || 'Sube evidencia por cláusula, fírmala y sigue el cumplimiento de la norma en tiempo real'}</p>
        </div>
        <div className="ph-actions">
          <button className="btn btn-out" onClick={exportCompliance} disabled={loading}><Icon d={ICONS.download} />Exportar cumplimiento</button>
          {canUpload && <button className="btn btn-red" onClick={() => setUploadFor({ clause: '' })}><Icon d={ICONS.plus} />Subir documento</button>}
        </div>
      </div>

      {error && (
        <div className="dm-error" role="alert" style={{ marginBottom: '1rem' }}>
          {error} <button className="btn btn-out btn-sm" style={{ marginLeft: 8 }} onClick={() => load()}>Reintentar</button>
        </div>
      )}

      {loading ? (
        <div className="dm-loading"><div className="dm-spinner" /><span>Cargando documentos…</span></div>
      ) : (
        <>
          <div className="sg">
            {statCards.map(card => (
              <div key={card.lbl} className={`sc ${card.cls}`}>
                <div className="sc-top"><div className="sc-icon"><Icon d={card.icon} size={19} /></div></div>
                <div className="sc-num">{card.num}</div>
                <div className="sc-lbl">{card.lbl}</div>
                <div style={{ fontSize: '.72rem', color: 'var(--ash)', marginTop: 4 }}>{card.sub}</div>
                <div className="sc-bar"><div className="sc-bar-f" style={{ width: `${card.bar}%` }} /></div>
              </div>
            ))}
          </div>

          {pending > 0 && (
            <div className="dm-banner">
              <Icon d={ICONS.pen} size={18} />
              <span>Tienes <strong>{pending}</strong> documento{pending > 1 ? 's' : ''} pendiente{pending > 1 ? 's' : ''} de tu firma.</span>
              <button className="btn btn-red btn-sm" onClick={() => { setView('tabla'); setFilterStatus('porfirmar') }}>Ver pendientes</button>
            </div>
          )}

          <div className="dm-legend">
            <strong>Cómo se calcula:</strong>
            <span><i style={{ background: '#9CA3AF' }} />Sin documentos = 0 %</span>
            <span><i style={{ background: '#F59E0B' }} />Documento cargado = 50 %</span>
            <span><i style={{ background: '#16A34A' }} />Documento vigente y firmado = 100 %</span>
            {iso?.unclassifiedDocuments > 0 && <span style={{ color: 'var(--warn)' }}>{iso.unclassifiedDocuments} documento(s) sin cláusula válida no cuentan</span>}
          </div>

          <div className="dm-tabs">
            <button className={`filter-tab${view === 'clausulas' ? ' active' : ''}`} onClick={() => setView('clausulas')}>Por cláusula ISO</button>
            <button className={`filter-tab${view === 'tabla' ? ' active' : ''}`} onClick={() => setView('tabla')}>Todos los documentos ({docs.length})</button>
          </div>

          {view === 'clausulas' ? (
            <ClauseTree tree={tree} docsByClause={docsByClause} onUpload={(clause) => setUploadFor({ clause })} onOpenDoc={openDoc} readOnly={!canUpload} />
          ) : (
            <div className="card">
              <div className="dm-filters">
                <div className="fsearch" style={{ minWidth: 220, flex: 1 }}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" /></svg>
                  <input placeholder="Buscar por código, título, responsable…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar documentos" />
                </div>
                <select className="fselect dm-filter" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} aria-label="Filtrar por estado">
                  <option value="todos">Todos los estados</option>
                  <option value="vigente">Vigentes</option>
                  <option value="en_revision">En revisión</option>
                  <option value="vencido">Vencidos</option>
                  <option value="archivado">Archivados</option>
                  <option value="porvencer">Por vencer (30 días)</option>
                  <option value="porfirmar">Pendientes de mi firma</option>
                  <option value="sinfirma">Sin ninguna firma</option>
                </select>
                <select className="fselect dm-filter" value={filterType} onChange={e => setFilterType(e.target.value)} aria-label="Filtrar por tipo">
                  <option value="todos">Todos los tipos</option>
                  {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <select className="fselect dm-filter" value={filterClause} onChange={e => setFilterClause(e.target.value)} aria-label="Filtrar por cláusula">
                  <option value="todas">Todas las cláusulas</option>
                  {tree.map(main => <option key={main.code} value={main.code}>{`${main.code} — ${main.title}`}</option>)}
                </select>
              </div>

              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>Código</th><th>Documento</th><th>Cláusula</th><th>Ver.</th><th>Estado</th><th>Firmas</th><th>Vigencia</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map(doc => {
                      const meta = STATUS_META[doc.status] || STATUS_META.vigente
                      const mySign = !doc.signatures.signedByMe && ['vigente', 'en_revision'].includes(doc.status)
                      return (
                        <tr key={doc.id}>
                          <td style={{ fontWeight: 700, color: 'var(--red)', fontSize: '.76rem', fontFamily: 'monospace' }}>{doc.code}</td>
                          <td>
                            <button type="button" className="dm-linkbtn" onClick={() => openDoc(doc)}>{doc.title}</button>
                            <div style={{ fontSize: '.7rem', color: 'var(--ash)' }}>{doc.type} · {doc.uploadedByName || '—'}</div>
                          </td>
                          <td>{doc.clause ? <span className="badge b-blue" style={{ fontSize: '.6rem' }}>{doc.clause}</span> : <span className="badge b-gray" style={{ fontSize: '.6rem' }}>Sin cláusula</span>}</td>
                          <td style={{ color: 'var(--ash)', fontWeight: 600, fontSize: '.8rem' }}>{doc.version}</td>
                          <td><span className={`badge ${meta.cls}`}>{meta.label}</span>{doc.expiringSoon && <span className="badge b-warn" style={{ marginLeft: 4 }}>Por vencer</span>}</td>
                          <td style={{ fontSize: '.8rem' }}>
                            <span style={{ color: doc.signatures.signed ? 'var(--ok)' : 'var(--ash)', fontWeight: 700 }}>{doc.signatures.signed}</span>
                            {doc.signatures.pending > 0 && <span style={{ color: 'var(--warn)', fontWeight: 600 }}> +{doc.signatures.pending} pend.</span>}
                            {doc.signatures.pendingForMe && <span className="badge b-red" style={{ marginLeft: 6 }}>Tú</span>}
                          </td>
                          <td style={{ fontSize: '.78rem', color: doc.status === 'vencido' ? 'var(--err)' : 'var(--ash)', fontWeight: doc.status === 'vencido' ? 700 : 400 }}>{fmtDate(doc.expiryDate)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '.3rem' }}>
                              <button className="ibtn" title="Ver" aria-label={`Ver ${doc.title}`} onClick={() => openDoc(doc)}><Icon d={ICONS.eye} /></button>
                              <button className="ibtn" title="Descargar" aria-label={`Descargar ${doc.title}`} onClick={() => downloadDocumentFile(doc.id).catch(err => toast(errorMessage(err), 'err'))}><Icon d={ICONS.download} /></button>
                              {mySign && <button className="ibtn ibtn-red" title="Firmar" aria-label={`Firmar ${doc.title}`} onClick={() => setSigning(doc)}><Icon d={ICONS.pen} /></button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {filtered.length === 0 && (
                <div className="dm-empty">
                  {docs.length === 0 ? (
                    <>
                      <strong>Aún no hay documentos</strong>
                      <span>{canUpload ? 'Sube el primero: el cumplimiento de la cláusula que elijas empezará a moverse de inmediato.' : 'Cuando el equipo suba documentos aparecerán aquí para revisarlos y firmarlos.'}</span>
                      {canUpload && <button className="btn btn-red" onClick={() => setUploadFor({ clause: '' })}><Icon d={ICONS.plus} />Subir documento</button>}
                    </>
                  ) : <span>Ningún documento coincide con los filtros.</span>}
                </div>
              )}
              <div style={{ padding: '.8rem 1.3rem', borderTop: '1px solid var(--border)', fontSize: '.78rem', color: 'var(--ash)' }}>
                Mostrando {filtered.length} de {docs.length} documentos
              </div>
            </div>
          )}
        </>
      )}

      {uploadFor && (
        <UploadModal tree={tree} initialClause={uploadFor.clause} onClose={() => setUploadFor(null)} onSaved={handleSaved} />
      )}
      {editing && (
        <UploadModal tree={tree} document={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
      {viewingDoc && !signing && !requesting && !editing && (
        <DocumentViewer
          key={viewingDoc.id}
          document={viewingDoc}
          user={user}
          canManage={canManage(viewingDoc)}
          onClose={() => setViewing(null)}
          onSign={setSigning}
          onRequest={(doc, alreadySigned) => setRequesting({ doc, alreadySigned })}
          onEdit={setEditing}
          onDeleted={handleDelete}
          onChanged={() => load({ silent: true })}
        />
      )}
      {signing && (
        <SignModal
          document={signing}
          onClose={() => setSigning(null)}
          onSigned={async () => { setSigning(null); await load({ silent: true }) }}
        />
      )}
      {requesting && (
        <RequestSignaturesModal
          document={requesting.doc}
          alreadySigned={requesting.alreadySigned}
          onClose={() => setRequesting(null)}
          onRequested={async () => { setRequesting(null); await load({ silent: true }) }}
        />
      )}
    </main>
  )
}

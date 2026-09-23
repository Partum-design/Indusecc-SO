import { useContext, useMemo, useRef, useState } from 'react'
import Modal from '../Modal'
import { toast } from '../Toast'
import { AuthContext } from '../../context/AuthContext'
import { updateDocument } from '../../api/api'
import {
  ACCEPT_ATTR, DOC_TYPES, MAX_FILE_SIZE, errorMessage, fileExtension, fmtSize, flattenSelectableClauses,
  uploadDocumentFile, validateFile,
} from '../../utils/documents'

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = (clause = '', responsible = '') => ({
  title: '', code: '', type: 'Procedimiento', clause, version: 'v.01', responsible, expiryDate: '', status: 'vigente', description: '',
})

// Modo alta (con archivo) y modo edición (`document` presente: solo metadatos).
export default function UploadModal({ tree, initialClause = '', document: editing = null, onClose, onSaved }) {
  const { user } = useContext(AuthContext)
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [form, setForm] = useState(() => (editing
    ? {
        title: editing.title || '', code: editing.code || '', type: editing.type || 'Procedimiento', clause: editing.clause || '',
        version: editing.version || 'v.01', responsible: editing.responsible || '', expiryDate: editing.expiryDate ? String(editing.expiryDate).slice(0, 10) : '',
        status: editing.storedStatus === 'en_revision' ? 'en_revision' : editing.storedStatus || 'vigente', description: editing.description || '',
      }
    : emptyForm(initialClause, user?.name || '')))
  const [progress, setProgress] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const clauses = useMemo(() => flattenSelectableClauses(tree), [tree])
  const grouped = useMemo(() => {
    const groups = new Map()
    clauses.forEach(c => {
      if (!groups.has(c.mainCode)) groups.set(c.mainCode, { title: c.mainTitle, items: [] })
      groups.get(c.mainCode).items.push(c)
    })
    return [...groups.entries()]
  }, [clauses])

  const set = (key) => (event) => {
    setError(null)
    setForm(prev => ({ ...prev, [key]: event.target.value }))
  }

  const pickFile = (candidate) => {
    const problem = validateFile(candidate)
    if (problem) {
      setFile(null)
      setError(problem)
      return
    }
    setError(null)
    setFile(candidate)
    setForm(prev => (prev.title ? prev : { ...prev, title: candidate.name.replace(/\.[^.]+$/, '') }))
  }

  const onDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files?.[0]) pickFile(event.dataTransfer.files[0])
  }

  const submit = async (event) => {
    event.preventDefault()
    setError(null)

    if (!editing && !file) return setError('Selecciona el archivo que quieres subir')
    if (!form.title.trim()) return setError('Escribe el título del documento')
    if (!form.clause) return setError('Elige la cláusula ISO 9001:2015 que respalda este documento')
    if (form.expiryDate && form.expiryDate < today() && form.status !== 'archivado' && !editing) {
      return setError('La fecha de vigencia ya pasó; el documento nacería vencido')
    }

    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(), code: form.code.trim(), type: form.type, clause: form.clause, version: form.version.trim() || 'v.01',
        responsible: form.responsible.trim(), expiryDate: form.expiryDate || null, description: form.description.trim(), status: form.status,
      }

      let saved
      if (editing) {
        const res = await updateDocument(editing.id, payload)
        saved = res.data.data.document
        toast('Documento actualizado', 'ok')
      } else {
        saved = await uploadDocumentFile(file, payload, setProgress)
        toast(`Documento ${saved.code} cargado y clasificado en la cláusula ${saved.clause}`, 'ok')
      }
      onSaved?.(saved)
    } catch (err) {
      setError(errorMessage(err, 'No se pudo guardar el documento'))
      setProgress(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editing ? 'Editar documento' : 'Subir documento ISO'}
      onClose={saving ? undefined : onClose}
      width={680}
      footer={(
        <>
          <button className="btn btn-out" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-red" form="dm-upload-form" type="submit" disabled={saving}>
            {saving ? (progress !== null && progress < 100 ? `Subiendo… ${progress}%` : 'Guardando…') : editing ? 'Guardar cambios' : 'Subir documento'}
          </button>
        </>
      )}
    >
      <form id="dm-upload-form" onSubmit={submit} noValidate>
        {!editing && (
          <div
            className={`dm-drop${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
          >
            <input ref={inputRef} type="file" accept={ACCEPT_ATTR} hidden onChange={e => e.target.files?.[0] && pickFile(e.target.files[0])} />
            {file ? (
              <>
                <div className="dm-drop-ext">{fileExtension(file.name).toUpperCase()}</div>
                <div style={{ fontWeight: 700, fontSize: '.9rem', wordBreak: 'break-all' }}>{file.name}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--ash)' }}>{fmtSize(file.size)} · haz clic para cambiar el archivo</div>
              </>
            ) : (
              <>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6" width="34"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <div style={{ fontWeight: 700, fontSize: '.9rem' }}>Arrastra tu archivo aquí o haz clic para elegirlo</div>
                <div style={{ fontSize: '.73rem', color: 'var(--ash)' }}>PDF, Word, Excel, PowerPoint, imágenes, TXT o CSV · máx. {fmtSize(MAX_FILE_SIZE)}</div>
              </>
            )}
          </div>
        )}

        {saving && progress !== null && (
          <div className="dm-upload-progress" aria-live="polite">
            <div className="dm-prog" style={{ height: 8 }}><div className="dm-prog-fill" style={{ width: `${progress}%`, background: 'var(--red)' }} /></div>
            <span>{progress < 100 ? `Subiendo ${progress}%` : 'Registrando y calculando huella SHA-256…'}</span>
          </div>
        )}

        <div className="form-grid" style={{ marginTop: editing ? 0 : '1.1rem' }}>
          <div className="form-group full">
            <label className="dm-label" htmlFor="dm-title">Título *</label>
            <input id="dm-title" className="finput" value={form.title} onChange={set('title')} placeholder="Ej. Procedimiento de Control de Documentos" maxLength={200} />
          </div>

          <div className="form-group full">
            <label className="dm-label" htmlFor="dm-clause">Cláusula ISO 9001:2015 *</label>
            <select id="dm-clause" className="fselect" value={form.clause} onChange={set('clause')}>
              <option value="">Selecciona la cláusula que este documento respalda…</option>
              {grouped.map(([code, group]) => (
                <optgroup key={code} label={`${code} — ${group.title}`}>
                  {group.items.map(c => (
                    <option key={c.code} value={c.code}>{`${'  '.repeat(c.level - 2)}${c.code} · ${c.title}`}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="dm-hint">Un documento en una cláusula “padre” (por ejemplo 7.1) respalda también a sus subcláusulas (7.1.1 a 7.1.6).</span>
          </div>

          <div className="form-group">
            <label className="dm-label" htmlFor="dm-code">Código</label>
            <input id="dm-code" className="finput" value={form.code} onChange={set('code')} placeholder="Automático si lo dejas vacío" maxLength={40} />
          </div>
          <div className="form-group">
            <label className="dm-label" htmlFor="dm-type">Tipo</label>
            <select id="dm-type" className="fselect" value={form.type} onChange={set('type')}>
              {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="dm-label" htmlFor="dm-version">Versión</label>
            <input id="dm-version" className="finput" value={form.version} onChange={set('version')} maxLength={20} />
          </div>
          <div className="form-group">
            <label className="dm-label" htmlFor="dm-resp">Responsable</label>
            <input id="dm-resp" className="finput" value={form.responsible} onChange={set('responsible')} placeholder="Nombre del responsable" maxLength={80} />
          </div>

          <div className="form-group">
            <label className="dm-label" htmlFor="dm-exp">Vigencia hasta</label>
            <input id="dm-exp" className="finput" type="date" value={form.expiryDate} onChange={set('expiryDate')} />
          </div>
          <div className="form-group">
            <label className="dm-label" htmlFor="dm-status">Estado</label>
            <select id="dm-status" className="fselect" value={form.status} onChange={set('status')}>
              <option value="vigente">Vigente</option>
              <option value="en_revision">En revisión</option>
              {editing && <option value="archivado">Archivado</option>}
              {editing?.storedStatus === 'vencido' && <option value="vencido">Vencido</option>}
            </select>
          </div>

          <div className="form-group full">
            <label className="dm-label" htmlFor="dm-desc">Descripción</label>
            <textarea id="dm-desc" className="ftextarea" rows={2} value={form.description} onChange={set('description')} placeholder="Alcance, cambios de la versión…" />
          </div>
        </div>

        {error && <div className="dm-error" role="alert">{error}</div>}
      </form>
    </Modal>
  )
}

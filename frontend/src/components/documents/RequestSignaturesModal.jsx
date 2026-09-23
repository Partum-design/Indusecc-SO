import { useEffect, useMemo, useState } from 'react'
import Modal from '../Modal'
import { toast } from '../Toast'
import { getUserDirectory, requestSignatures } from '../../api/api'
import { errorMessage } from '../../utils/documents'
import { formatRole } from '../../utils/userHelpers'

export default function RequestSignaturesModal({ document: doc, alreadySigned = [], onClose, onRequested }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getUserDirectory()
      .then(res => { if (!cancelled) setUsers(res.data.data.users) })
      .catch(err => { if (!cancelled) setError(errorMessage(err, 'No se pudo cargar la lista de usuarios')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users
      .filter(u => !u.isSelf)
      .filter(u => !term || u.name.toLowerCase().includes(term) || (u.department || '').toLowerCase().includes(term) || formatRole(u.role).toLowerCase().includes(term))
  }, [users, search])

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const submit = async () => {
    setError(null)
    if (!selected.size) return setError('Selecciona al menos una persona')
    setSaving(true)
    try {
      const { data } = await requestSignatures(doc.id, { userIds: [...selected], message: message.trim() || undefined })
      toast(data.message, 'ok')
      onRequested?.()
    } catch (err) {
      setError(errorMessage(err, 'No se pudo enviar la solicitud'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Solicitar firmas"
      onClose={saving ? undefined : onClose}
      width={540}
      footer={(
        <>
          <button className="btn btn-out" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-red" onClick={submit} disabled={saving || !selected.size}>
            {saving ? 'Enviando…' : `Enviar solicitud${selected.size ? ` (${selected.size})` : ''}`}
          </button>
        </>
      )}
    >
      <p style={{ fontSize: '.85rem', color: 'var(--ink6)', marginBottom: '.9rem' }}>
        Cada persona recibirá una notificación (y un correo si está configurado) para firmar <strong>{doc.title}</strong>.
      </p>

      <div className="fsearch" style={{ marginBottom: '.7rem' }}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" /></svg>
        <input placeholder="Buscar por nombre, área o rol…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="dm-picker">
        {loading && <div className="dm-empty-line">Cargando usuarios…</div>}
        {!loading && visible.length === 0 && <div className="dm-empty-line">No hay usuarios que coincidan.</div>}
        {visible.map(u => {
          const signed = alreadySigned.includes(u.id)
          return (
            <label key={u.id} className={`dm-picker-row${signed ? ' disabled' : ''}`}>
              <input type="checkbox" disabled={signed} checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
              <span className="dm-avatar">{u.name.slice(0, 2).toUpperCase()}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '.85rem' }}>{u.name}</span>
                <span style={{ display: 'block', fontSize: '.72rem', color: 'var(--ash)' }}>{formatRole(u.role)}{u.department ? ` · ${u.department}` : ''}</span>
              </span>
              {signed && <span className="badge b-ok">Ya firmó</span>}
            </label>
          )
        })}
      </div>

      <div className="form-group" style={{ marginTop: '1rem' }}>
        <label className="dm-label" htmlFor="dm-req-msg">Mensaje (opcional)</label>
        <textarea id="dm-req-msg" className="ftextarea" rows={2} value={message} onChange={e => setMessage(e.target.value)} maxLength={500} placeholder="Ej. Necesito tu firma antes del viernes" />
      </div>

      {error && <div className="dm-error" role="alert">{error}</div>}
    </Modal>
  )
}

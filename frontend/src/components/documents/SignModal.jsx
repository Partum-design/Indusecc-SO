import { useContext, useState } from 'react'
import Modal from '../Modal'
import SignaturePad from '../SignaturePad'
import { toast } from '../Toast'
import { AuthContext } from '../../context/AuthContext'
import { signDocument } from '../../api/api'
import { errorMessage } from '../../utils/documents'

export default function SignModal({ document: doc, onClose, onSigned }) {
  const { user } = useContext(AuthContext)
  const [image, setImage] = useState(null)
  const [comment, setComment] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const submit = async () => {
    setError(null)
    if (!image) return setError('Dibuja o escribe tu firma para continuar')
    if (!accepted) return setError('Debes aceptar la declaración de firma')

    setSaving(true)
    try {
      const { data } = await signDocument(doc.id, { signatureImage: image, comment: comment.trim() || undefined, accept: true })
      toast(data.message || 'Documento firmado', 'ok')
      onSigned?.(data.data)
    } catch (err) {
      setError(errorMessage(err, 'No se pudo firmar el documento'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Firmar documento"
      onClose={saving ? undefined : onClose}
      width={620}
      footer={(
        <>
          <button className="btn btn-out" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-red" onClick={submit} disabled={saving}>{saving ? 'Firmando…' : 'Firmar documento'}</button>
        </>
      )}
    >
      <div className="dm-sign-doc">
        <div className="dm-docline-code">{doc.code} · {doc.version}</div>
        <div style={{ fontWeight: 700 }}>{doc.title}</div>
        <div style={{ fontSize: '.75rem', color: 'var(--ash)' }}>Cláusula {doc.clause || '—'} · SHA-256 {doc.sha256 ? `${doc.sha256.slice(0, 12)}…` : 'se calculará al firmar'}</div>
      </div>

      <SignaturePad onChange={setImage} defaultName={user?.name || ''} />

      <div className="form-group" style={{ marginTop: '1rem' }}>
        <label className="dm-label" htmlFor="dm-sign-comment">Comentario (opcional)</label>
        <textarea id="dm-sign-comment" className="ftextarea" rows={2} value={comment} onChange={e => setComment(e.target.value)} maxLength={500} placeholder="Ej. Revisado y conforme" />
      </div>

      <label className="dm-check">
        <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
        <span>
          Declaro que revisé este documento y que esta firma electrónica me identifica como <strong>{user?.name || user?.email}</strong>.
          Se registrarán mi nombre, fecha y hora, dirección IP y la huella SHA-256 del archivo. Una firma emitida no puede modificarse.
        </span>
      </label>

      {error && <div className="dm-error" role="alert">{error}</div>}
    </Modal>
  )
}

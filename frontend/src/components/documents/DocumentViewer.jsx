import { useCallback, useEffect, useState } from 'react'
import Modal from '../Modal'
import ConfirmDialog from '../ConfirmDialog'
import { toast } from '../Toast'
import {
  cancelSignatureRequest, getSignatures, resendSignatureRequest, verifyDocument,
} from '../../api/api'
import {
  STATUS_META, downloadDocumentFile, errorMessage, fetchDocumentBlob, fmtDate, fmtDateTime, fmtSize, previewKind, timeAgo,
} from '../../utils/documents'
import { formatRole } from '../../utils/userHelpers'

function Preview({ doc }) {
  const kind = previewKind(doc.mimetype)
  const [state, setState] = useState({ loading: kind !== null, url: null, text: null, error: null })

  useEffect(() => {
    if (!kind) return undefined
    let revoked = false
    let objectUrl = null
    fetchDocumentBlob(doc.id)
      .then(async ({ blob }) => {
        if (revoked) return
        if (kind === 'text') {
          setState({ loading: false, url: null, text: (await blob.text()).slice(0, 60000), error: null })
        } else {
          objectUrl = URL.createObjectURL(blob)
          setState({ loading: false, url: objectUrl, text: null, error: null })
        }
      })
      .catch(err => { if (!revoked) setState({ loading: false, url: null, text: null, error: errorMessage(err, 'No se pudo cargar la vista previa') }) })
    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [doc.id, kind])

  if (!kind) {
    return (
      <div className="dm-preview dm-preview-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.4" width="42"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
        <strong>Vista previa no disponible</strong>
        <span>Los archivos {doc.originalName?.split('.').pop()?.toUpperCase()} se abren descargándolos.</span>
        <button className="btn btn-out btn-sm" onClick={() => downloadDocumentFile(doc.id).catch(err => toast(errorMessage(err), 'err'))}>Descargar archivo</button>
      </div>
    )
  }
  if (state.loading) return <div className="dm-preview dm-preview-empty"><div className="dm-spinner" /><span>Cargando vista previa…</span></div>
  if (state.error) return <div className="dm-preview dm-preview-empty"><strong>{state.error}</strong></div>
  if (kind === 'image') return <div className="dm-preview"><img src={state.url} alt={doc.title} className="dm-preview-img" /></div>
  if (kind === 'text') return <div className="dm-preview"><pre className="dm-preview-text">{state.text}</pre></div>
  return <div className="dm-preview"><iframe title={doc.title} src={state.url} className="dm-preview-frame" /></div>
}

function SignatureRow({ signature, canManage, currentUserId, busy, onResend, onCancel }) {
  const signed = signature.status === 'firmada'
  const canRemind = !signed && (canManage || signature.requestedBy === currentUserId)
  return (
    <div className={`dm-sig${signed ? ' signed' : ''}`}>
      <span className="dm-avatar">{(signature.signerName || '?').slice(0, 2).toUpperCase()}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '.84rem' }}>{signature.signerName || 'Usuario'}</div>
        <div style={{ fontSize: '.71rem', color: 'var(--ash)' }}>{signature.signerRole ? formatRole(signature.signerRole) : ''}</div>
        {signed ? (
          <>
            <div style={{ fontSize: '.72rem', color: 'var(--ok)', fontWeight: 600, marginTop: 3 }}>Firmado el {fmtDateTime(signature.signedAt)}</div>
            {signature.comment && <div style={{ fontSize: '.72rem', color: 'var(--ink6)', fontStyle: 'italic', marginTop: 2 }}>“{signature.comment}”</div>}
            {signature.signatureImage && <img className="dm-sig-img" src={signature.signatureImage} alt={`Firma de ${signature.signerName}`} />}
            <div className="dm-hash" title={signature.signatureHash}>huella {signature.signatureHash?.slice(0, 16)}…</div>
          </>
        ) : (
          <div style={{ fontSize: '.72rem', color: 'var(--warn)', fontWeight: 600, marginTop: 3 }}>
            Pendiente · solicitada {timeAgo(signature.requestedAt)}{signature.requestedByName ? ` por ${signature.requestedByName}` : ''}
            {signature.reminderCount > 0 && <span style={{ color: 'var(--ash)', fontWeight: 500 }}> · {signature.reminderCount} recordatorio(s), último {timeAgo(signature.lastRemindedAt)}</span>}
          </div>
        )}
      </div>
      {canRemind && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button className="btn btn-out btn-sm" disabled={busy} onClick={() => onResend(signature)} title="Reenviar notificación al firmante">Reenviar</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onCancel(signature)} title="Cancelar la solicitud">Cancelar</button>
        </div>
      )}
    </div>
  )
}

export default function DocumentViewer({ document: doc, user, canManage, onClose, onSign, onRequest, onEdit, onDeleted, onChanged }) {
  const [signatures, setSignatures] = useState([])
  const [loadingSigs, setLoadingSigs] = useState(true)
  const [busy, setBusy] = useState(false)
  const [integrity, setIntegrity] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const statusMeta = STATUS_META[doc.status] || STATUS_META.vigente
  const signable = (doc.status === 'vigente' || doc.status === 'en_revision') && !doc.signatures.signedByMe

  const loadSignatures = useCallback(async () => {
    try {
      const res = await getSignatures(doc.id)
      setSignatures(res.data.data.signatures)
    } catch (err) {
      toast(errorMessage(err, 'No se pudieron cargar las firmas'), 'err')
    } finally {
      setLoadingSigs(false)
    }
  }, [doc.id])

  // `doc.signatures` cambia cuando el padre recarga (firma, solicitud...): se vuelve a pedir el detalle.
  useEffect(() => { loadSignatures() }, [loadSignatures, doc.signatures.signed, doc.signatures.pending])

  const resend = async (signature) => {
    setBusy(true)
    try {
      const { data } = await resendSignatureRequest(doc.id, signature.id)
      toast(data.message, 'ok')
      await loadSignatures()
    } catch (err) {
      toast(errorMessage(err, 'No se pudo reenviar'), 'err')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (signature) => {
    setBusy(true)
    try {
      await cancelSignatureRequest(doc.id, signature.id)
      toast('Solicitud de firma cancelada', 'ok')
      await loadSignatures()
      onChanged?.()
    } catch (err) {
      toast(errorMessage(err, 'No se pudo cancelar'), 'err')
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setBusy(true)
    try {
      const { data } = await verifyDocument(doc.id)
      setIntegrity(data.data)
      toast(data.data.fileIntact && data.data.signatures.every(s => s.valid) ? 'Integridad verificada: el archivo y las firmas son válidos' : 'Atención: se detectaron diferencias', data.data.fileIntact ? 'ok' : 'err')
    } catch (err) {
      toast(errorMessage(err, 'No se pudo verificar'), 'err')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await onDeleted(doc)
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  const signedIds = signatures.filter(s => s.status === 'firmada').map(s => s.signerId)
  const pendingSigs = signatures.filter(s => s.status === 'pendiente')

  return (
    <>
      <Modal
        title={(
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>{doc.title}</span>
            <span className={`badge ${statusMeta.cls}`} style={{ fontFamily: 'DM Sans, sans-serif' }}>{statusMeta.label}</span>
          </span>
        )}
        onClose={onClose}
        width={1120}
        bodyStyle={{ padding: 0 }}
      >
        <div className="dm-viewer">
          <Preview key={doc.id} doc={doc} />

          <aside className="dm-side">
            <section>
              <div className="dm-actions">
                <button className="btn btn-out btn-sm" onClick={() => downloadDocumentFile(doc.id).catch(err => toast(errorMessage(err), 'err'))}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Descargar
                </button>
                {canManage && <button className="btn btn-out btn-sm" onClick={() => onEdit(doc)}>Editar</button>}
                {canManage && (
                  <button className="btn btn-out btn-sm" style={{ color: 'var(--err)' }} onClick={() => setConfirmDelete(true)}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Eliminar
                  </button>
                )}
              </div>
            </section>

            <section>
              <h4 className="dm-side-title">Detalle</h4>
              <dl className="dm-dl">
                <dt>Código</dt><dd className="mono">{doc.code}</dd>
                <dt>Cláusula ISO</dt><dd>{doc.clause ? <span className="badge b-blue">{doc.clause}</span> : '—'}</dd>
                <dt>Tipo</dt><dd>{doc.type || '—'}</dd>
                <dt>Versión</dt><dd>{doc.version}</dd>
                <dt>Responsable</dt><dd>{doc.responsible || '—'}</dd>
                <dt>Subido por</dt><dd>{doc.uploadedByName || '—'} · {fmtDate(doc.createdAt)}</dd>
                <dt>Vigencia</dt><dd style={{ color: doc.status === 'vencido' ? 'var(--err)' : doc.expiringSoon ? 'var(--warn)' : undefined, fontWeight: doc.expiringSoon || doc.status === 'vencido' ? 700 : 400 }}>
                  {doc.expiryDate ? fmtDate(doc.expiryDate) : 'Sin vencimiento'}{doc.expiringSoon ? ' (por vencer)' : ''}
                </dd>
                <dt>Archivo</dt><dd style={{ wordBreak: 'break-all' }}>{doc.originalName} · {fmtSize(doc.size)}</dd>
                <dt>SHA-256</dt><dd className="mono" style={{ wordBreak: 'break-all', fontSize: '.68rem' }}>{doc.sha256 || '—'}</dd>
              </dl>
              {doc.description && <p className="dm-desc">{doc.description}</p>}
            </section>

            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: '.6rem' }}>
                <h4 className="dm-side-title" style={{ margin: 0 }}>Firmas electrónicas ({doc.signatures.signed}{doc.signatures.pending ? ` + ${doc.signatures.pending} pendiente${doc.signatures.pending > 1 ? 's' : ''}` : ''})</h4>
              </div>

              <div className="dm-actions" style={{ marginBottom: '.8rem' }}>
                {signable && (
                  <button className="btn btn-red btn-sm" onClick={() => onSign(doc)}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.94L6 18l1.232-4.414A4 4 0 018.172 12.172z" /></svg>
                    {doc.signatures.pendingForMe ? 'Firmar (pendiente de ti)' : 'Firmar documento'}
                  </button>
                )}
                {canManage && (doc.status === 'vigente' || doc.status === 'en_revision') && (
                  <button className="btn btn-out btn-sm" onClick={() => onRequest(doc, signedIds)}>Solicitar firmas</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={verify} disabled={busy}>Verificar integridad</button>
              </div>

              {doc.signatures.signedByMe && <div className="dm-note ok">Ya firmaste este documento.</div>}
              {(doc.status === 'vencido' || doc.status === 'archivado') && <div className="dm-note warn">Un documento {statusMeta.label.toLowerCase()} ya no se puede firmar.</div>}

              {integrity && (
                <div className={`dm-note ${integrity.fileIntact && integrity.signatures.every(s => s.valid) ? 'ok' : 'err'}`}>
                  {integrity.fileIntact ? 'El archivo coincide con la huella registrada.' : 'El archivo NO coincide con la huella registrada: fue alterado.'}
                  {integrity.signatures.length > 0 && ` Firmas válidas: ${integrity.signatures.filter(s => s.valid).length} de ${integrity.signatures.length}.`}
                </div>
              )}

              {loadingSigs && <div className="dm-empty-line">Cargando firmas…</div>}
              {!loadingSigs && signatures.length === 0 && <div className="dm-empty-line">Nadie ha firmado ni se ha solicitado la firma todavía.</div>}
              {pendingSigs.length > 1 && canManage && (
                <div className="dm-note info">{pendingSigs.length} firmas pendientes: usa “Reenviar” en cada persona para recordárselo.</div>
              )}
              <div className="dm-sigs">
                {signatures.map(signature => (
                  <SignatureRow key={signature.id} signature={signature} canManage={canManage} currentUserId={user?.id}
                    busy={busy} onResend={resend} onCancel={cancel} />
                ))}
              </div>
            </section>
          </aside>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        danger
        busy={busy}
        title="Eliminar documento"
        message={`Se eliminará “${doc.title}” (${doc.code}) junto con sus ${doc.signatures.signed} firma(s) y el archivo. Esta acción no se puede deshacer y el cumplimiento de la cláusula ${doc.clause || ''} se recalculará.`}
        confirmLabel="Sí, eliminar"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}

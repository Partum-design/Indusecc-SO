import Modal from './Modal'

export default function ConfirmDialog({ open, title = 'Confirmar', message, confirmLabel = 'Confirmar', danger = false, busy = false, onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onCancel}
      width={440}
      footer={(
        <>
          <button className="btn btn-out" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button className="btn btn-red" style={danger ? undefined : { background: 'var(--ok)' }} onClick={onConfirm} disabled={busy}>
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </>
      )}
    >
      <p style={{ fontSize: '.9rem', color: 'var(--ink6)', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  )
}

import { useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import { toast } from '../../components/Toast'
import { SEVERITY_COLOR } from '../../utils/notifications'
import {
  clearReadNotifications, deleteNotification, getNotifications, getSentNotifications, getUserDirectory,
  markAllNotificationsRead, markNotificationRead, resendNotification, sendNotification,
} from '../../api/api'
import { errorMessage, fmtDateTime, timeAgo } from '../../utils/documents'
import { formatRole } from '../../utils/userHelpers'

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'COLABORADOR', 'CONSULTOR']
const PAGE_SIZE = 20

function SendNoticeModal({ onClose, onSent }) {
  const [target, setTarget] = useState('role')
  const [role, setRole] = useState('COLABORADOR')
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState('info')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getUserDirectory().then(res => setUsers(res.data.data.users.filter(u => !u.isSelf))).catch(() => {})
  }, [])

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const submit = async () => {
    setError(null)
    if (!title.trim()) return setError('Escribe un título')
    if (target === 'users' && !selected.size) return setError('Selecciona al menos un destinatario')
    setSaving(true)
    try {
      const payload = { title: title.trim(), message: message.trim() || undefined, severity, ...(target === 'role' ? { role } : { userIds: [...selected] }) }
      const { data } = await sendNotification(payload)
      toast(data.message, 'ok')
      onSent()
    } catch (err) {
      setError(errorMessage(err, 'No se pudo enviar el aviso'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Enviar aviso" onClose={saving ? undefined : onClose} width={560}
      footer={(<><button className="btn btn-out" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn btn-red" onClick={submit} disabled={saving}>{saving ? 'Enviando…' : 'Enviar aviso'}</button></>)}>
      <div className="form-grid">
        <div className="form-group full">
          <label className="dm-label">Destinatarios</label>
          <div style={{ display: 'flex', gap: '.4rem' }}>
            <button type="button" className={`filter-tab${target === 'role' ? ' active' : ''}`} onClick={() => setTarget('role')}>Todo un rol</button>
            <button type="button" className={`filter-tab${target === 'users' ? ' active' : ''}`} onClick={() => setTarget('users')}>Personas concretas</button>
          </div>
        </div>
        {target === 'role' ? (
          <div className="form-group full">
            <select className="fselect" value={role} onChange={e => setRole(e.target.value)} aria-label="Rol destinatario">
              {ROLES.map(r => <option key={r} value={r}>{formatRole(r)}</option>)}
            </select>
          </div>
        ) : (
          <div className="form-group full">
            <div className="dm-picker">
              {users.map(u => (
                <label key={u.id} className="dm-picker-row">
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                  <span className="dm-avatar">{u.name.slice(0, 2).toUpperCase()}</span>
                  <span style={{ flex: 1, fontSize: '.85rem', fontWeight: 600 }}>{u.name}<span style={{ display: 'block', fontSize: '.72rem', color: 'var(--ash)', fontWeight: 400 }}>{formatRole(u.role)}</span></span>
                </label>
              ))}
              {users.length === 0 && <div className="dm-empty-line">Cargando usuarios…</div>}
            </div>
          </div>
        )}
        <div className="form-group full">
          <label className="dm-label" htmlFor="nt-title">Título *</label>
          <input id="nt-title" className="finput" value={title} onChange={e => setTitle(e.target.value)} maxLength={140} placeholder="Ej. Reunión de revisión por la dirección" />
        </div>
        <div className="form-group full">
          <label className="dm-label" htmlFor="nt-msg">Mensaje</label>
          <textarea id="nt-msg" className="ftextarea" rows={3} value={message} onChange={e => setMessage(e.target.value)} maxLength={1000} />
        </div>
        <div className="form-group">
          <label className="dm-label" htmlFor="nt-sev">Importancia</label>
          <select id="nt-sev" className="fselect" value={severity} onChange={e => setSeverity(e.target.value)}>
            <option value="info">Informativa</option>
            <option value="success">Positiva</option>
            <option value="warning">Atención</option>
            <option value="error">Urgente</option>
          </select>
        </div>
      </div>
      {error && <div className="dm-error" role="alert">{error}</div>}
    </Modal>
  )
}

export default function Notificaciones() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role)

  const [tab, setTab] = useState('received')
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [sent, setSent] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [composing, setComposing] = useState(false)

  const loadReceived = useCallback(async (nextPage = 1, append = false) => {
    setLoading(true)
    try {
      const { data } = await getNotifications({ page: nextPage, limit: PAGE_SIZE, ...(onlyUnread ? { unread: 'true' } : {}) })
      setItems(prev => (append ? [...prev, ...data.data.notifications] : data.data.notifications))
      setUnread(data.data.unreadCount)
      setPage(nextPage)
      setPages(data.data.pagination.pages)
    } catch (err) {
      toast(errorMessage(err, 'No se pudieron cargar las notificaciones'), 'err')
    } finally {
      setLoading(false)
    }
  }, [onlyUnread])

  const loadSent = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await getSentNotifications()
      setSent(data.data.notifications)
    } catch (err) {
      toast(errorMessage(err, 'No se pudieron cargar las notificaciones enviadas'), 'err')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (tab === 'received') loadReceived(1) }, [tab, loadReceived])
  useEffect(() => { if (tab === 'sent') loadSent() }, [tab, loadSent])

  const open = async (item) => {
    if (!item.read) {
      setItems(prev => prev.map(n => (n.id === item.id ? { ...n, read: true } : n)))
      setUnread(prev => Math.max(0, prev - 1))
      markNotificationRead(item.id).catch(() => {})
    }
    if (item.link) navigate(item.link)
  }

  const toggleRead = async (item) => {
    if (item.read) return
    setBusyId(item.id)
    try {
      await markNotificationRead(item.id)
      setItems(prev => prev.map(n => (n.id === item.id ? { ...n, read: true } : n)))
      setUnread(prev => Math.max(0, prev - 1))
    } catch (err) {
      toast(errorMessage(err), 'err')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (item) => {
    setBusyId(item.id)
    try {
      await deleteNotification(item.id)
      setItems(prev => prev.filter(n => n.id !== item.id))
      if (!item.read) setUnread(prev => Math.max(0, prev - 1))
    } catch (err) {
      toast(errorMessage(err), 'err')
    } finally {
      setBusyId(null)
    }
  }

  const markAll = async () => {
    try {
      await markAllNotificationsRead()
      toast('Todas marcadas como leídas', 'ok')
      loadReceived(1)
    } catch (err) {
      toast(errorMessage(err), 'err')
    }
  }

  const clearRead = async () => {
    try {
      const { data } = await clearReadNotifications()
      toast(`${data.data.deleted} notificación(es) eliminada(s)`, 'ok')
      loadReceived(1)
    } catch (err) {
      toast(errorMessage(err), 'err')
    }
  }

  const resend = async (item) => {
    setBusyId(item.id)
    try {
      const { data } = await resendNotification(item.id)
      toast(data.message, 'ok')
      await loadSent()
    } catch (err) {
      toast(errorMessage(err, 'No se pudo reenviar'), 'err')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="page">
      <div className="ph">
        <div>
          <h1 className="ph-title">Centro de <em>notificaciones</em></h1>
          <p className="ph-sub">{unread ? `${unread} sin leer` : 'Estás al día'} · tareas, firmas, auditorías y avisos</p>
        </div>
        <div className="ph-actions">
          {isAdmin && <button className="btn btn-red" onClick={() => setComposing(true)}>Enviar aviso</button>}
        </div>
      </div>

      <div className="dm-tabs">
        <button className={`filter-tab${tab === 'received' ? ' active' : ''}`} onClick={() => setTab('received')}>Recibidas</button>
        <button className={`filter-tab${tab === 'sent' ? ' active' : ''}`} onClick={() => setTab('sent')}>Enviadas (reenviar)</button>
      </div>

      <div className="card">
        {tab === 'received' ? (
          <>
            <div className="dm-filters">
              <button className={`filter-tab${!onlyUnread ? ' active' : ''}`} onClick={() => setOnlyUnread(false)}>Todas</button>
              <button className={`filter-tab${onlyUnread ? ' active' : ''}`} onClick={() => setOnlyUnread(true)}>Sin leer</button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '.4rem' }}>
                <button className="btn btn-out btn-sm" onClick={markAll} disabled={!unread}>Marcar todas como leídas</button>
                <button className="btn btn-ghost btn-sm" onClick={clearRead}>Eliminar leídas</button>
              </div>
            </div>

            {loading && items.length === 0 && <div className="dm-loading"><div className="dm-spinner" /></div>}
            {!loading && items.length === 0 && <div className="dm-empty"><strong>{onlyUnread ? 'No tienes notificaciones sin leer' : 'No tienes notificaciones'}</strong><span>Cuando te asignen tareas, te pidan una firma o haya avisos, aparecerán aquí.</span></div>}

            {items.map(item => (
              <div key={item.id} className={`nt-page-item${item.read ? '' : ' unread'}`}>
                <span className="nt-dot" style={{ background: SEVERITY_COLOR[item.severity] || SEVERITY_COLOR.info, marginTop: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button type="button" className="dm-linkbtn" style={{ fontWeight: item.read ? 600 : 800 }} onClick={() => open(item)}>{item.title}</button>
                  {item.message && <div className="nt-msg" style={{ fontSize: '.8rem' }}>{item.message}</div>}
                  <div className="nt-time">{fmtDateTime(item.lastSentAt || item.createdAt)} · {timeAgo(item.lastSentAt || item.createdAt)}{item.resendCount > 0 ? ` · reenviada ${item.resendCount}×` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {item.link && <button className="btn btn-out btn-sm" onClick={() => open(item)}>Abrir</button>}
                  {!item.read && <button className="btn btn-ghost btn-sm" disabled={busyId === item.id} onClick={() => toggleRead(item)}>Marcar leída</button>}
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--err)' }} disabled={busyId === item.id} onClick={() => remove(item)} aria-label="Eliminar notificación">Eliminar</button>
                </div>
              </div>
            ))}

            {page < pages && (
              <div style={{ padding: '1rem', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-out" onClick={() => loadReceived(page + 1, true)} disabled={loading}>{loading ? 'Cargando…' : 'Cargar más'}</button>
              </div>
            )}
          </>
        ) : (
          <>
            {loading && sent.length === 0 && <div className="dm-loading"><div className="dm-spinner" /></div>}
            {!loading && sent.length === 0 && <div className="dm-empty"><strong>Aún no has enviado notificaciones</strong><span>Las que generes al pedir firmas o enviar avisos aparecerán aquí para que puedas reenviarlas.</span></div>}
            {sent.map(item => (
              <div key={item.id} className="nt-page-item">
                <span className="nt-dot" style={{ background: SEVERITY_COLOR[item.severity] || SEVERITY_COLOR.info, marginTop: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '.85rem' }}>{item.title}</div>
                  <div className="nt-msg" style={{ fontSize: '.78rem' }}>Para <strong>{item.recipient?.name || 'usuario'}</strong> · {item.read ? <span style={{ color: 'var(--ok)', fontWeight: 700 }}>Leída</span> : <span style={{ color: 'var(--warn)', fontWeight: 700 }}>Sin leer</span>}</div>
                  <div className="nt-time">Enviada {fmtDateTime(item.createdAt)}{item.resendCount > 0 ? ` · reenviada ${item.resendCount}× (última ${timeAgo(item.lastSentAt)})` : ''}{item.emailSent ? ' · con correo' : ''}</div>
                </div>
                <button className="btn btn-out btn-sm" disabled={busyId === item.id} onClick={() => resend(item)}>{busyId === item.id ? 'Reenviando…' : 'Reenviar'}</button>
              </div>
            ))}
          </>
        )}
      </div>

      {composing && <SendNoticeModal onClose={() => setComposing(false)} onSent={() => { setComposing(false); setTab('sent'); loadSent() }} />}
    </main>
  )
}

import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { toast } from './Toast'
import { deleteNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from '../api/api'
import { timeAgo } from '../utils/documents'
import { roleBase } from '../utils/userHelpers'
import { SEVERITY_COLOR } from '../utils/notifications'

const POLL_MS = 30000

// Campana del encabezado: consulta las notificaciones reales del usuario cada 30 s (solo con la pestaña visible).
export default function NotificationsBell() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const rootRef = useRef(null)
  const lastSeenTime = useRef(undefined)

  const refresh = useCallback(async () => {
    try {
      const { data } = await getNotifications({ limit: 12 })
      const list = data.data.notifications
      setItems(list)
      setUnread(data.data.unreadCount)
      setFailed(false)

      // Aviso emergente cuando llega (o se reenvía) algo nuevo; no en la primera carga.
      const sentAt = (n) => new Date(n.lastSentAt || n.createdAt).getTime()
      const latest = list.reduce((max, n) => Math.max(max, sentAt(n)), 0)
      if (lastSeenTime.current !== undefined) {
        const fresh = list.filter(n => !n.read && sentAt(n) > lastSeenTime.current)
        if (fresh.length) {
          const first = fresh[0]
          toast(fresh.length > 1 ? `Tienes ${fresh.length} notificaciones nuevas` : first.title,
            first.severity === 'error' ? 'err' : first.severity === 'warning' ? 'warn' : 'n')
        }
      }
      lastSeenTime.current = Math.max(latest, lastSeenTime.current || 0)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false) }
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    refresh()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, refresh])

  const openItem = async (item) => {
    setOpen(false)
    if (!item.read) {
      setItems(prev => prev.map(n => (n.id === item.id ? { ...n, read: true } : n)))
      setUnread(prev => Math.max(0, prev - 1))
      markNotificationRead(item.id).catch(() => {})
    }
    if (item.link) navigate(item.link)
  }

  const markAll = async () => {
    try {
      await markAllNotificationsRead()
      setItems(prev => prev.map(n => ({ ...n, read: true })))
      setUnread(0)
    } catch {
      toast('No se pudieron marcar como leídas', 'err')
    }
  }

  const remove = async (event, item) => {
    event.stopPropagation()
    try {
      await deleteNotification(item.id)
      setItems(prev => prev.filter(n => n.id !== item.id))
      if (!item.read) setUnread(prev => Math.max(0, prev - 1))
    } catch {
      toast('No se pudo eliminar la notificación', 'err')
    }
  }

  return (
    <div style={{ position: 'relative' }} ref={rootRef}>
      <button className="tbtn" onClick={() => setOpen(v => !v)} aria-label={unread ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'} aria-expanded={open}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
        {unread > 0 && <span className="nt-bell-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="nt-panel" role="dialog" aria-label="Notificaciones">
          <div className="nt-panel-hd">
            <div>
              <div style={{ fontWeight: 700, fontSize: '.88rem' }}>Notificaciones</div>
              <div style={{ fontSize: '.7rem', color: 'var(--ash)' }}>{unread ? `${unread} sin leer` : 'Estás al día'}</div>
            </div>
            {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAll}>Marcar todas</button>}
          </div>

          <div className="nt-list">
            {loading && <div className="nt-empty">Cargando…</div>}
            {!loading && failed && items.length === 0 && <div className="nt-empty">No se pudieron cargar las notificaciones.<br /><button className="btn btn-out btn-sm" style={{ marginTop: 8 }} onClick={refresh}>Reintentar</button></div>}
            {!loading && !failed && items.length === 0 && <div className="nt-empty">No tienes notificaciones.<br />Aquí aparecerán tareas, firmas y avisos.</div>}
            {items.map(item => (
              <div key={item.id} className={`nt-item${item.read ? '' : ' unread'}`} role="button" tabIndex={0}
                onClick={() => openItem(item)} onKeyDown={e => { if (e.key === 'Enter') openItem(item) }}>
                <span className="nt-dot" style={{ background: SEVERITY_COLOR[item.severity] || SEVERITY_COLOR.info }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="nt-title" style={{ fontWeight: item.read ? 600 : 800 }}>{item.title}</div>
                  {item.message && <div className="nt-msg">{item.message}</div>}
                  <div className="nt-time">{timeAgo(item.lastSentAt || item.createdAt)}{item.resendCount > 0 ? ` · reenviada ${item.resendCount}×` : ''}</div>
                </div>
                <button className="ibtn" style={{ width: 24, height: 24 }} title="Eliminar" aria-label="Eliminar notificación" onClick={e => remove(e, item)}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>

          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', borderRadius: 0, border: 'none', borderTop: '1px solid var(--border)', padding: '.75rem', color: 'var(--red)' }}
            onClick={() => { setOpen(false); navigate(`${roleBase(user?.role)}/notificaciones`) }}>
            Ver todas las notificaciones
          </button>
        </div>
      )}
    </div>
  )
}

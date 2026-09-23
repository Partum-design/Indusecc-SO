import { useCallback, useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { toast } from '../../components/Toast'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { createAction, deleteAction, getActions, getUserDirectory, updateAction } from '../../api/api'
import { downloadBlob } from '../../utils/downloadHelpers'
import { errorMessage } from '../../utils/documents'

const STATUSES = ['Iniciada', 'En Proceso', 'Cerrada']
const PRIORITY_LABEL = { high: 'Alta', medium: 'Media', low: 'Baja' }
const PRIORITY_BADGE = { high: 'b-err', medium: 'b-warn', low: 'b-gray' }
const EMPTY_FORM = { title: '', description: '', area: '', assignedTo: '', dueDate: '', priority: 'medium' }

const isOverdue = (action) => action.status !== 'Cerrada' && action.dueDate && new Date(action.dueDate) < new Date(new Date().toDateString())
const fmt = (value) => (value ? new Date(value).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : '—')

// Acciones de mejora continua (cláusula 10.2 y 10.3): se crean, se asignan (el responsable recibe
// una notificación) y avanzan de estado. Todo viene de la base de datos.
export default function MejoraContinua() {
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('Todas')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await getActions()
      setActions(res.data?.data?.actions || [])
    } catch (err) {
      setError(errorMessage(err, 'No se pudieron cargar las acciones'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    getUserDirectory().then(res => setUsers(res.data.data.users)).catch(() => {})
  }, [])

  const filtered = useMemo(() => actions.filter(a => {
    if (filter === 'Abiertas') return a.status !== 'Cerrada'
    if (filter === 'Vencidas') return isOverdue(a)
    if (filter === 'Cerradas') return a.status === 'Cerrada'
    return true
  }), [actions, filter])

  const counts = useMemo(() => {
    const closed = actions.filter(a => a.status === 'Cerrada').length
    return {
      total: actions.length,
      open: actions.length - closed,
      overdue: actions.filter(isOverdue).length,
      closed,
      pct: actions.length ? Math.round((closed / actions.length) * 100) : 0,
    }
  }, [actions])

  const byArea = useMemo(() => {
    const groups = new Map()
    actions.forEach(a => {
      const key = a.area || 'Sin área'
      const entry = groups.get(key) || { total: 0, done: 0 }
      entry.total += 1
      if (a.status === 'Cerrada') entry.done += 1
      groups.set(key, entry)
    })
    return [...groups.entries()].map(([area, v]) => ({ area, pct: Math.round((v.done / v.total) * 100), total: v.total })).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [actions])

  const upcoming = useMemo(() => actions
    .filter(a => a.status !== 'Cerrada' && a.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 4), [actions])

  const changeStatus = async (action, status) => {
    setBusyId(action.id)
    try {
      await updateAction(action.id, { status })
      setActions(prev => prev.map(a => (a.id === action.id ? { ...a, status } : a)))
    } catch (err) {
      toast(errorMessage(err, 'No se pudo cambiar el estado'), 'err')
    } finally {
      setBusyId(null)
    }
  }

  const save = async () => {
    setFormError(null)
    if (!form.title.trim()) return setFormError('Escribe el título de la acción')
    setSaving(true)
    try {
      await createAction({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        area: form.area.trim() || undefined,
        assignedTo: form.assignedTo || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
      })
      toast(form.assignedTo ? 'Acción creada y notificada al responsable' : 'Acción creada', 'ok')
      setModal(false)
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setFormError(errorMessage(err, 'No se pudo guardar la acción'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setBusyId(toDelete.id)
    try {
      await deleteAction(toDelete.id)
      toast('Acción eliminada', 'ok')
      setToDelete(null)
      await load()
    } catch (err) {
      toast(errorMessage(err, 'No se pudo eliminar la acción'), 'err')
    } finally {
      setBusyId(null)
    }
  }

  const exportCsv = () => {
    if (!actions.length) return toast('No hay acciones para exportar', 'warn')
    const csv = Papa.unparse(actions.map(a => ({
      Título: a.title, Descripción: a.description || '', Área: a.area || '', Responsable: a.assignedTo?.name || 'Sin asignar',
      Prioridad: PRIORITY_LABEL[a.priority] || a.priority, Plazo: a.dueDate || '', Estado: a.status,
    })))
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `acciones_mejora_${new Date().toISOString().slice(0, 10)}.csv`)
    toast('Listado exportado correctamente', 'ok')
  }

  const cards = [
    { cls: 'sc-blue', num: counts.total, lbl: 'Acciones registradas', bar: 100 },
    { cls: 'sc-warn', num: counts.open, lbl: 'Abiertas', bar: counts.total ? Math.round((counts.open / counts.total) * 100) : 0 },
    { cls: 'sc-red', num: counts.overdue, lbl: 'Vencidas', bar: counts.total ? Math.round((counts.overdue / counts.total) * 100) : 0 },
    { cls: 'sc-ok', num: `${counts.pct}%`, lbl: 'Cerradas', bar: counts.pct },
  ]

  return (
    <main className="page">
      <div className="ph">
        <div>
          <h1 className="ph-title">Mejora <em>Continua</em></h1>
          <p className="ph-sub">Acciones correctivas, preventivas y de mejora (cláusulas 10.2 y 10.3) · el responsable recibe un aviso al asignarlas</p>
        </div>
        <div className="ph-actions">
          <button className="btn btn-out" onClick={exportCsv}>Exportar CSV</button>
          <button className="btn btn-red" onClick={() => { setForm(EMPTY_FORM); setFormError(null); setModal(true) }}>Nueva acción</button>
        </div>
      </div>

      {error && <div className="dm-error" role="alert" style={{ marginBottom: '1rem' }}>{error} <button className="btn btn-out btn-sm" style={{ marginLeft: 8 }} onClick={load}>Reintentar</button></div>}

      <div className="sg">
        {cards.map(card => (
          <div key={card.lbl} className={`sc ${card.cls}`}>
            <div className="sc-num">{loading ? '…' : card.num}</div>
            <div className="sc-lbl">{card.lbl}</div>
            <div className="sc-bar"><div className="sc-bar-f" style={{ width: `${card.bar}%` }} /></div>
          </div>
        ))}
      </div>

      <div className="mg">
        <div className="card">
          <div className="card-hd">
            <div className="card-hd-l"><div><div className="card-title">Acciones de mejora</div><div className="card-sub">{filtered.length} de {actions.length}</div></div></div>
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
              {['Todas', 'Abiertas', 'Vencidas', 'Cerradas'].map(f => (
                <button key={f} className={`filter-tab${filter === f ? ' active' : ''}`} style={{ fontSize: '.72rem', padding: '5px 10px' }} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
          </div>

          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Acción</th><th>Área</th><th>Responsable</th><th>Prioridad</th><th>Plazo</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '.85rem', color: a.status === 'Cerrada' ? 'var(--ash)' : 'inherit' }}>{a.title}</div>
                      {a.description && <div style={{ fontSize: '.72rem', color: 'var(--ash)' }}>{a.description}</div>}
                    </td>
                    <td style={{ fontSize: '.78rem', color: 'var(--ash)' }}>{a.area || '—'}</td>
                    <td style={{ fontSize: '.8rem' }}>{a.assignedTo?.name || <span style={{ color: 'var(--ash)' }}>Sin asignar</span>}</td>
                    <td><span className={`badge ${PRIORITY_BADGE[a.priority] || 'b-gray'}`}>{PRIORITY_LABEL[a.priority] || a.priority}</span></td>
                    <td style={{ fontSize: '.78rem', color: isOverdue(a) ? 'var(--err)' : 'inherit', fontWeight: isOverdue(a) ? 700 : 400 }}>{fmt(a.dueDate)}{isOverdue(a) ? ' · vencida' : ''}</td>
                    <td>
                      <select className="fselect" style={{ padding: '5px 8px', fontSize: '.75rem', width: 'auto' }} value={a.status} disabled={busyId === a.id}
                        onChange={e => changeStatus(a, e.target.value)} aria-label={`Estado de ${a.title}`}>
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <button className="ibtn" title="Eliminar" aria-label={`Eliminar ${a.title}`} onClick={() => setToDelete(a)}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length === 0 && (
            <div className="dm-empty">
              <strong>{actions.length ? 'Ninguna acción coincide con el filtro' : 'Aún no hay acciones'}</strong>
              {!actions.length && <span>Crea la primera y asígnala: el responsable la verá en “Mis Tareas” y recibirá una notificación.</span>}
            </div>
          )}
        </div>

        <div className="col-r">
          <div className="card">
            <div className="card-hd"><div className="card-hd-l"><div><div className="card-title">Próximos plazos</div><div className="card-sub">Acciones abiertas</div></div></div></div>
            <div style={{ padding: '.6rem 1rem' }}>
              {upcoming.length === 0 && <div style={{ padding: '1rem 0', fontSize: '.8rem', color: 'var(--ash)' }}>Sin plazos pendientes.</div>}
              {upcoming.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '.8rem' }}>
                  <span style={{ fontWeight: 600 }}>{a.title}</span>
                  <span style={{ color: isOverdue(a) ? 'var(--err)' : 'var(--ash)', whiteSpace: 'nowrap', fontWeight: isOverdue(a) ? 700 : 400 }}>{fmt(a.dueDate)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-hd"><div className="card-hd-l"><div><div className="card-title">Cierre por área</div></div></div></div>
            <div style={{ padding: '1rem' }}>
              {byArea.length === 0 && <div style={{ textAlign: 'center', color: 'var(--ash)', fontSize: '.8rem' }}>Sin datos todavía</div>}
              {byArea.map(e => (
                <div key={e.area} style={{ marginBottom: '.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', marginBottom: '.3rem' }}>
                    <span>{e.area} <span style={{ color: 'var(--ash)' }}>({e.total})</span></span>
                    <span style={{ fontWeight: 700 }}>{e.pct}%</span>
                  </div>
                  <div className="prog-wrap"><div className="prog-fill" style={{ width: `${e.pct}%`, background: e.pct > 80 ? 'var(--ok)' : e.pct > 50 ? 'var(--gold)' : 'var(--warn)' }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <Modal
          title="Nueva acción"
          onClose={saving ? undefined : () => setModal(false)}
          footer={(<><button className="btn btn-out" onClick={() => setModal(false)} disabled={saving}>Cancelar</button><button className="btn btn-red" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar acción'}</button></>)}
        >
          <div className="form-grid">
            <div className="form-group full">
              <label className="dm-label" htmlFor="ac-title">Título *</label>
              <input id="ac-title" className="finput" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej. Instalar extintores en almacén norte" maxLength={160} />
            </div>
            <div className="form-group full">
              <label className="dm-label" htmlFor="ac-desc">Descripción</label>
              <textarea id="ac-desc" className="ftextarea" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="dm-label" htmlFor="ac-area">Área</label>
              <input id="ac-area" className="finput" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} placeholder="Ej. Calidad" />
            </div>
            <div className="form-group">
              <label className="dm-label" htmlFor="ac-user">Responsable</label>
              <select id="ac-user" className="fselect" value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })}>
                <option value="">Sin asignar</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="dm-label" htmlFor="ac-due">Plazo</label>
              <input id="ac-due" className="finput" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="dm-label" htmlFor="ac-pri">Prioridad</label>
              <select id="ac-pri" className="fselect" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option>
              </select>
            </div>
          </div>
          {formError && <div className="dm-error" role="alert">{formError}</div>}
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        busy={busyId === toDelete?.id}
        title="Eliminar acción"
        message={toDelete ? `Se eliminará “${toDelete.title}”. Esta acción no se puede deshacer.` : ''}
        confirmLabel="Sí, eliminar"
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </main>
  )
}

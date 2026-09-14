import { useState, useCallback, useEffect } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useDashboard } from '../context/DashboardContext'
import Modal from '../components/Modal'
import { Calendar as CalIcon, Plus, Check, RefreshCw, Link2, Unlink, AlertTriangle, Loader2 } from 'lucide-react'
import { getSyncStatus, runSync, connectGoogleCalendar, disconnectGoogle } from '../lib/googleCalendar'

const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales: { es } })

const messages = {
  today: 'Hoy', previous: '‹', next: '›', month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda',
  date: 'Fecha', time: 'Hora', event: 'Evento', noEventsInRange: 'Sin eventos',
}

// <input type="datetime-local"> only accepts YYYY-MM-DDTHH:mm in LOCAL time.
// A timestamptz from Postgres ("2026-09-13T15:00:00+00:00") is rejected outright
// and the field renders blank, so convert in both directions.
const toLocalInput = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d)) return ''
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}
const toISO = (localValue) => {
  if (!localValue) return ''
  const d = new Date(localValue)
  return isNaN(d) ? '' : d.toISOString()
}

function EventForm({ event, defaultStart, onSave, onClose }) {
  const { projects } = useDashboard()
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    start_datetime: toLocalInput(event?.start_datetime || defaultStart || new Date()),
    end_datetime: toLocalInput(event?.end_datetime),
    all_day: event?.all_day || false,
    color: event?.color || '#7c3aed',
    project_id: event?.project_id || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [formError, setFormError] = useState('')

  const save = () => {
    if (!form.title.trim()) {
      setFormError('El título es obligatorio.')
      return
    }
    // start_datetime es NOT NULL en la base: sin esto el error que vería el
    // usuario sería «null value in column start_datetime violates not-null».
    const start = toISO(form.start_datetime)
    if (!start) {
      setFormError(form.all_day ? 'Elige una fecha.' : 'Elige una fecha y hora de inicio.')
      return
    }
    setFormError('')
    onSave({
      ...form,
      start_datetime: start,
      end_datetime: toISO(form.end_datetime),
    })
  }

  const COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777', '#0891b2']

  return (
    <div className="space-y-4">
      <div><label className="label">Título *</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} /></div>
      <div><label className="label">Descripción</label><textarea className="input resize-none" rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="allday" checked={form.all_day} onChange={e => set('all_day', e.target.checked)} className="rounded" />
        <label htmlFor="allday" className="text-sm text-zinc-300">Todo el día</label>
      </div>
      {!form.all_day && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Inicio</label><input type="datetime-local" className="input" value={form.start_datetime} onChange={e => set('start_datetime', e.target.value)} /></div>
          <div><label className="label">Fin</label><input type="datetime-local" className="input" value={form.end_datetime} onChange={e => set('end_datetime', e.target.value)} /></div>
        </div>
      )}
      {form.all_day && (
        <div><label className="label">Fecha</label><input type="date" className="input" value={form.start_datetime?.split('T')[0] || ''} onChange={e => set('start_datetime', e.target.value + 'T00:00')} /></div>
      )}
      <div>
        <label className="label">Proyecto</label>
        <select className="input" value={form.project_id} onChange={e => set('project_id', e.target.value)}>
          <option value="">Sin proyecto</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Color</label>
        <div className="flex gap-2 mt-1">
          {COLORS.map(c => (
            <button key={c} onClick={() => set('color', c)} className={`w-7 h-7 rounded-full ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''}`} style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      {formError && (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{formError}</div>
      )}
      <div className="flex gap-2 pt-2">
        <button onClick={save} className="btn-primary flex-1 justify-center"><Check size={15} />{event ? 'Actualizar' : 'Crear'}</button>
        <button onClick={onClose} className="btn-ghost">Cancelar</button>
      </div>
    </div>
  )
}

function GoogleSyncBar({ onSynced, onStatus }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    let next
    try { next = await getSyncStatus() } catch { next = { connected: false } }
    setStatus(next)
    onStatus?.(next.connected)
  }, [onStatus])

  useEffect(() => { refresh() }, [refresh])

  // Al volver del consentimiento de Google, el contexto ya guardó el token;
  // aquí solo hace falta releer el estado y lanzar la primera bajada.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('google') !== 'connected') return
    window.history.replaceState({}, '', window.location.pathname)
    setBusy(true)
    setMsg('Conectando con Google...')
    // El token se guarda en cuanto Supabase entrega la sesión; se espera un
    // instante para no adelantarse a esa escritura.
    const t = setTimeout(async () => {
      try {
        await refresh()
        const r = await runSync()
        setMsg(`Conectado. ${r.pulled} eventos importados.`)
        onSynced?.()
      } catch (e) {
        setError(e.message)
      } finally {
        setBusy(false)
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [refresh, onSynced])

  const sync = async () => {
    setBusy(true); setError(''); setMsg('')
    try {
      const r = await runSync()
      const parts = []
      if (r.pulled) parts.push(`${r.pulled} de Google`)
      if (r.pushed) parts.push(`${r.pushed} enviados`)
      if (r.removed) parts.push(`${r.removed} eliminados`)
      setMsg(parts.length ? `Sincronizado: ${parts.join(' · ')}` : 'Todo estaba al día.')
      await refresh()
      onSynced?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true); setError(''); setMsg('')
    try {
      await disconnectGoogle()
      await refresh()
      setMsg('Cuenta desconectada. Los eventos ya importados se quedan aquí.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!status) return null

  return (
    <div className="mb-4 flex items-center gap-3 flex-wrap text-sm">
      {status.connected ? (
        <>
          <button onClick={sync} disabled={busy} className="btn-ghost border border-zinc-700 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Sincronizar con Google
          </button>
          <span className="text-xs text-zinc-500">
            {status.lastSyncAt
              ? `Última vez: ${format(new Date(status.lastSyncAt), "d MMM HH:mm", { locale: es })}`
              : 'Aún sin sincronizar'}
          </span>
          <button onClick={disconnect} disabled={busy} className="text-xs text-zinc-600 hover:text-red-400 flex items-center gap-1 ml-auto">
            <Unlink size={11} /> Desconectar
          </button>
        </>
      ) : (
        <button onClick={() => connectGoogleCalendar().catch(e => setError(e.message))} className="btn-ghost border border-zinc-700">
          <Link2 size={14} /> Conectar Google Calendar
        </button>
      )}

      {msg && <span className="text-xs text-green-400">{msg}</span>}

      {(error || status.lastError) && (
        <span className="text-xs text-red-400 flex items-center gap-1.5 w-full">
          <AlertTriangle size={12} className="flex-shrink-0" /> {error || status.lastError}
        </span>
      )}
    </div>
  )
}

export default function CalendarView() {
  const { calendarEvents, tasks, createEvent, updateEvent, deleteEvent, reload } = useDashboard()
  const [modal, setModal] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [googleConnected, setGoogleConnected] = useState(false)

  const events = [
    ...calendarEvents.map(e => ({
      id: e.id,
      title: e.title,
      start: new Date(e.start_datetime),
      end: e.end_datetime ? new Date(e.end_datetime) : new Date(e.start_datetime),
      allDay: e.all_day,
      resource: { type: 'event', color: e.color || '#7c3aed', raw: e, synced: !!e.google_event_id },
    })),
    ...tasks.filter(t => t.due_date && t.status !== 'done').map(t => ({
      id: `task-${t.id}`,
      title: `📌 ${t.title}`,
      start: new Date(t.due_date + 'T00:00:00'),
      end: new Date(t.due_date + 'T23:59:59'),
      allDay: true,
      resource: { type: 'task', color: '#6366f1', raw: t },
    })),
  ]

  const eventStyleGetter = (event) => {
    const r = event.resource
    // Un evento propio que aún no llegó a Google se marca con borde punteado:
    // así se distingue «todavía no sincronizado» de «ya está en las dos partes».
    const pending = r?.type === 'event' && googleConnected && !r.synced
    return {
      style: {
        backgroundColor: r?.color || '#7c3aed',
        border: pending ? '1px dashed rgba(255,255,255,.55)' : 'none',
        borderRadius: '6px',
        fontSize: '12px',
        padding: '2px 6px',
        opacity: pending ? 0.75 : 1,
      },
    }
  }

  const onSelectSlot = useCallback(({ start }) => {
    setSelectedSlot(start)
    setModal('new')
  }, [])

  const onSelectEvent = useCallback((event) => {
    if (event.resource?.type === 'event') setModal(event.resource.raw)
  }, [])

  const handleSave = async (form) => {
    setSaveError('')
    try {
      if (modal === 'new') await createEvent(form)
      else await updateEvent(modal.id, form)
      setModal(null)
    } catch (err) {
      setSaveError(err.message)
    }
  }

  const handleDelete = async () => {
    setSaveError('')
    try {
      if (modal?.id) await deleteEvent(modal.id)
      setModal(null)
    } catch (err) {
      setSaveError(err.message)
    }
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <CalIcon size={20} className="text-zinc-400" /> Calendario
        </h1>
        <button onClick={() => { setSelectedSlot(new Date()); setModal('new') }} className="btn-primary">
          <Plus size={15} /> Nuevo evento
        </button>
      </div>

      <GoogleSyncBar onSynced={reload} onStatus={setGoogleConnected} />

      <div className="flex-1 min-h-0">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          culture="es"
          messages={messages}
          eventPropGetter={eventStyleGetter}
          onSelectSlot={onSelectSlot}
          onSelectEvent={onSelectEvent}
          selectable
          style={{ height: '100%' }}
          views={['month', 'week', 'day', 'agenda']}
          defaultView="month"
        />
      </div>

      {modal !== null && (
        <Modal title={modal === 'new' ? 'Nuevo evento' : 'Editar evento'} onClose={() => { setModal(null); setSaveError('') }}>
          {saveError && (
            <div className="mb-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{saveError}</div>
          )}
          <EventForm
            event={modal === 'new' ? null : modal}
            defaultStart={selectedSlot}
            onSave={handleSave}
            onClose={() => { setModal(null); setSaveError('') }}
          />
          {modal !== 'new' && (
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <button onClick={handleDelete} className="btn-danger w-full justify-center">Eliminar evento</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

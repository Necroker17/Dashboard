import { useState, useCallback } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useDashboard } from '../context/DashboardContext'
import Modal from '../components/Modal'
import { Calendar as CalIcon, Plus, Check } from 'lucide-react'

const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales: { es } })

const messages = {
  today: 'Hoy', previous: '‹', next: '›', month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda',
  date: 'Fecha', time: 'Hora', event: 'Evento', noEventsInRange: 'Sin eventos',
}

function EventForm({ event, onSave, onClose }) {
  const { projects } = useDashboard()
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    start_datetime: event?.start_datetime || new Date().toISOString().slice(0, 16),
    end_datetime: event?.end_datetime || '',
    all_day: event?.all_day || false,
    color: event?.color || '#7c3aed',
    project_id: event?.project_id || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const save = () => { if (form.title.trim()) onSave(form) }

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
        <div><label className="label">Fecha</label><input type="date" className="input" value={form.start_datetime?.split('T')[0]} onChange={e => set('start_datetime', e.target.value + 'T00:00')} /></div>
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
      <div className="flex gap-2 pt-2">
        <button onClick={save} className="btn-primary flex-1 justify-center"><Check size={15} />{event ? 'Actualizar' : 'Crear'}</button>
        <button onClick={onClose} className="btn-ghost">Cancelar</button>
      </div>
    </div>
  )
}

export default function CalendarView() {
  const { calendarEvents, tasks, createEvent, updateEvent, deleteEvent } = useDashboard()
  const [modal, setModal] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)

  const events = [
    ...calendarEvents.map(e => ({
      id: e.id,
      title: e.title,
      start: new Date(e.start_datetime),
      end: e.end_datetime ? new Date(e.end_datetime) : new Date(e.start_datetime),
      allDay: e.all_day,
      resource: { type: 'event', color: e.color || '#7c3aed', raw: e },
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

  const eventStyleGetter = (event) => ({
    style: {
      backgroundColor: event.resource?.color || '#7c3aed',
      border: 'none',
      borderRadius: '6px',
      fontSize: '12px',
      padding: '2px 6px',
    }
  })

  const onSelectSlot = useCallback(({ start }) => {
    setSelectedSlot(start)
    setModal('new')
  }, [])

  const onSelectEvent = useCallback((event) => {
    if (event.resource?.type === 'event') setModal(event.resource.raw)
  }, [])

  const handleSave = async (form) => {
    if (modal === 'new') {
      await createEvent({
        ...form,
        start_datetime: selectedSlot ? selectedSlot.toISOString() : form.start_datetime,
      })
    } else {
      await updateEvent(modal.id, form)
    }
    setModal(null)
  }

  const handleDelete = async () => {
    if (modal?.id) await deleteEvent(modal.id)
    setModal(null)
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
        <Modal title={modal === 'new' ? 'Nuevo evento' : 'Editar evento'} onClose={() => setModal(null)}>
          <EventForm
            event={modal === 'new' ? null : modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
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

import { useState, useMemo } from 'react'
import { useDashboard } from '../context/DashboardContext'
import Modal from '../components/Modal'
import { ListFilter, Plus, Search, ChevronDown, ChevronRight, CheckCircle2, Circle, Pencil, Trash2, Check } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }
const PRIORITY_LABELS = { urgent: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' }
const STATUS_LABELS = { backlog: 'Backlog', todo: 'Por hacer', in_progress: 'En progreso', review: 'Revisión', done: 'Hecho' }
const STATUS_COLORS = { backlog: '#6b7280', todo: '#3b82f6', in_progress: '#f59e0b', review: '#8b5cf6', done: '#22c55e' }

const GROUP_OPTIONS = [
  { value: 'status', label: 'Estado' },
  { value: 'priority', label: 'Prioridad' },
  { value: 'project', label: 'Proyecto' },
  { value: 'due_date', label: 'Fecha límite' },
  { value: 'none', label: 'Sin agrupar' },
]

function TaskForm({ task, projects, onSave, onClose }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    due_date: task?.due_date || '',
    project_id: task?.project_id || '',
    tags: task?.tags?.join(', ') || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const save = () => {
    if (!form.title.trim()) return
    onSave({ ...form, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] })
  }
  return (
    <div className="space-y-4">
      <div><label className="label">Título *</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} /></div>
      <div><label className="label">Descripción</label><textarea className="input resize-none" rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Estado</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Prioridad</label>
          <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Fecha límite</label><input type="date" className="input" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></div>
        <div>
          <label className="label">Proyecto</label>
          <select className="input" value={form.project_id} onChange={e => set('project_id', e.target.value)}>
            <option value="">Sin proyecto</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div><label className="label">Etiquetas (coma)</label><input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} /></div>
      <div className="flex gap-2 pt-2">
        <button onClick={save} className="btn-primary flex-1 justify-center"><Check size={15} />{task ? 'Actualizar' : 'Crear'}</button>
        <button onClick={onClose} className="btn-ghost">Cancelar</button>
      </div>
    </div>
  )
}

function GroupSection({ label, tasks, color, projects, onToggle, onEdit, onDelete, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full py-2 text-left hover:bg-zinc-800/30 rounded-lg px-2 -ml-2 transition-colors"
      >
        {open ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
        <span className="font-medium text-sm" style={{ color: color || '#a1a1aa' }}>{label}</span>
        <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">{tasks.length}</span>
      </button>

      {open && (
        <div className="ml-4 border-l border-zinc-800 pl-4 space-y-0.5 mt-1 mb-4">
          {tasks.map(task => {
            const project = projects.find(p => p.id === task.project_id)
            return (
              <div key={task.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-zinc-800/40 transition-colors group">
                <button onClick={() => onToggle(task)} className="flex-shrink-0 text-zinc-600 hover:text-violet-400 transition-colors">
                  {task.status === 'done' ? <CheckCircle2 size={16} className="text-green-400" /> : <Circle size={16} />}
                </button>

                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <span className={`text-sm ${task.status === 'done' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>{task.title}</span>
                  {task.tags?.slice(0, 2).map(t => (
                    <span key={t} className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded-full hidden md:inline">{t}</span>
                  ))}
                </div>

                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  {project && (
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color || '#7c3aed' }} />
                      {project.name.slice(0, 12)}
                    </span>
                  )}
                  {task.due_date && (
                    <span className="text-xs text-zinc-500">{format(new Date(task.due_date + 'T00:00:00'), 'd MMM', { locale: es })}</span>
                  )}
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: PRIORITY_COLORS[task.priority] + '20', color: PRIORITY_COLORS[task.priority] }}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                  <button onClick={() => onEdit(task)} className="text-zinc-600 hover:text-zinc-300 p-0.5 rounded"><Pencil size={12} /></button>
                  <button onClick={() => onDelete(task.id)} className="text-zinc-600 hover:text-red-400 p-0.5 rounded"><Trash2 size={12} /></button>
                </div>
              </div>
            )
          })}
          {tasks.length === 0 && <div className="text-xs text-zinc-600 py-2">Sin tareas</div>}
        </div>
      )}
    </div>
  )
}

export default function ListView() {
  const { tasks, projects, createTask, updateTask, deleteTask } = useDashboard()
  const [groupBy, setGroupBy] = useState('status')
  const [search, setSearch] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [modal, setModal] = useState(null)

  const filtered = useMemo(() => {
    let t = tasks
    if (!showDone) t = t.filter(task => task.status !== 'done')
    if (search) t = t.filter(task => task.title.toLowerCase().includes(search.toLowerCase()))
    return t
  }, [tasks, search, showDone])

  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'Todas las tareas', tasks: filtered, color: '#a1a1aa' }]

    if (groupBy === 'status') {
      return Object.entries(STATUS_LABELS).map(([status, label]) => ({
        key: status, label, color: STATUS_COLORS[status],
        tasks: filtered.filter(t => t.status === status),
      })).filter(g => g.tasks.length > 0)
    }

    if (groupBy === 'priority') {
      return Object.entries(PRIORITY_LABELS).map(([priority, label]) => ({
        key: priority, label, color: PRIORITY_COLORS[priority],
        tasks: filtered.filter(t => t.priority === priority),
      })).filter(g => g.tasks.length > 0)
    }

    if (groupBy === 'project') {
      const withProject = projects.map(p => ({
        key: p.id, label: p.name, color: p.color || '#7c3aed',
        tasks: filtered.filter(t => t.project_id === p.id),
      })).filter(g => g.tasks.length > 0)
      const noProject = filtered.filter(t => !t.project_id)
      return [...withProject, ...(noProject.length ? [{ key: 'none', label: 'Sin proyecto', color: '#6b7280', tasks: noProject }] : [])]
    }

    if (groupBy === 'due_date') {
      const today = format(new Date(), 'yyyy-MM-dd')
      const groups = [
        { key: 'overdue', label: 'Vencidas', color: '#ef4444', tasks: filtered.filter(t => t.due_date && t.due_date < today) },
        { key: 'today', label: 'Hoy', color: '#f59e0b', tasks: filtered.filter(t => t.due_date === today) },
        { key: 'upcoming', label: 'Próximas', color: '#3b82f6', tasks: filtered.filter(t => t.due_date && t.due_date > today) },
        { key: 'nodate', label: 'Sin fecha', color: '#6b7280', tasks: filtered.filter(t => !t.due_date) },
      ]
      return groups.filter(g => g.tasks.length > 0)
    }

    return []
  }, [filtered, groupBy, projects])

  const handleSave = async (form) => {
    if (modal === 'new') await createTask(form)
    else await updateTask(modal.id, form)
    setModal(null)
  }

  const toggleDone = async (task) => {
    await updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <ListFilter size={20} className="text-zinc-400" /> Lista
        </h1>
        <button onClick={() => setModal('new')} className="btn-primary"><Plus size={15} /> Nueva tarea</button>
      </div>

      {/* Controls */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-40 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input className="input pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Agrupar por:</span>
          <select className="input w-auto text-sm" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
            {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
          <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} className="rounded" />
          Mostrar completadas
        </label>
      </div>

      {/* Task count */}
      <div className="text-xs text-zinc-500 mb-4">{filtered.length} tareas · {tasks.filter(t => t.status === 'done').length} completadas</div>

      {/* Groups */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <ListFilter size={40} className="mx-auto mb-3 opacity-20" />
          <p>No hay tareas</p>
        </div>
      ) : (
        <div>
          {grouped.map(group => (
            <GroupSection
              key={group.key}
              label={group.label}
              tasks={group.tasks}
              color={group.color}
              projects={projects}
              onToggle={toggleDone}
              onEdit={t => setModal(t)}
              onDelete={deleteTask}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <Modal title={modal === 'new' ? 'Nueva tarea' : 'Editar tarea'} onClose={() => setModal(null)}>
          <TaskForm task={modal === 'new' ? null : modal} projects={projects} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}

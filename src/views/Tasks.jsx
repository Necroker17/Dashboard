import { useState, useMemo } from 'react'
import { useDashboard } from '../context/DashboardContext'
import Modal from '../components/Modal'
import { format, isPast, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CheckSquare, Plus, Search, Filter, Trash2, Pencil,
  Check, Clock, Tag, ChevronDown, CheckCircle2, Circle
} from 'lucide-react'

const PRIORITY_COLORS = { urgent: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-green-400' }
const PRIORITY_BG = { urgent: 'bg-red-500/10', high: 'bg-orange-500/10', medium: 'bg-yellow-500/10', low: 'bg-green-500/10' }
const PRIORITY_LABELS = { urgent: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' }
const STATUS_LABELS = { backlog: 'Backlog', todo: 'Por hacer', in_progress: 'En progreso', review: 'Revisión', done: 'Hecho' }
const COLUMNS = ['backlog', 'todo', 'in_progress', 'review', 'done']

function TaskRow({ task, projects, onEdit, onDelete, onToggle }) {
  const project = projects.find(p => p.id === task.project_id)
  const due = task.due_date ? new Date(task.due_date + 'T00:00:00') : null
  const overdue = due && isPast(due) && !isToday(due) && task.status !== 'done'
  const done = task.status === 'done'

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-800/40 transition-colors group ${overdue ? 'border-l-2 border-red-500' : ''}`}>
      <button onClick={() => onToggle(task)} className="mt-0.5 flex-shrink-0 text-zinc-600 hover:text-violet-400 transition-colors">
        {done ? <CheckCircle2 size={18} className="text-green-400" /> : <Circle size={18} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${done ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
          {task.title}
        </div>
        {task.description && <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{task.description}</div>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {project && (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color || '#7c3aed' }} />
              {project.name}
            </span>
          )}
          {task.due_date && (
            <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-400' : 'text-zinc-500'}`}>
              <Clock size={10} />
              {format(new Date(task.due_date + 'T00:00:00'), 'd MMM', { locale: es })}
              {overdue && ' (vencida)'}
            </span>
          )}
          {task.tags?.map(t => (
            <span key={t} className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-full">{t}</span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className={`badge text-xs ${PRIORITY_BG[task.priority]} ${PRIORITY_COLORS[task.priority]}`}>
          {PRIORITY_LABELS[task.priority]}
        </span>
        <button onClick={() => onEdit(task)} className="text-zinc-500 hover:text-zinc-300 p-1 rounded">
          <Pencil size={13} />
        </button>
        <button onClick={() => onDelete(task.id)} className="text-zinc-500 hover:text-red-400 p-1 rounded">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

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
            {COLUMNS.map(c => <option key={c} value={c}>{STATUS_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Prioridad</label>
          <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
            {['urgent','high','medium','low'].map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
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

export default function Tasks() {
  const { tasks, projects, createTask, updateTask, deleteTask } = useDashboard()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterProject, setFilterProject] = useState('all')
  const [modal, setModal] = useState(null)

  const filtered = useMemo(() => tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false
    if (filterProject !== 'all' && t.project_id !== filterProject) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [tasks, search, filterStatus, filterPriority, filterProject])

  const grouped = useMemo(() => {
    const g = {}
    COLUMNS.forEach(c => { g[c] = filtered.filter(t => t.status === c) })
    return g
  }, [filtered])

  const handleSave = async (form) => {
    if (modal === 'new') await createTask(form)
    else await updateTask(modal.id, form)
    setModal(null)
  }

  const toggleDone = async (task) => {
    await updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' })
  }

  const totalActive = tasks.filter(t => t.status !== 'done').length
  const totalDone = tasks.filter(t => t.status === 'done').length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2"><CheckSquare size={20} className="text-zinc-400" /> Tareas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{totalActive} activas · {totalDone} completadas</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary"><Plus size={15} /> Nueva tarea</button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-40 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input className="input pl-9" placeholder="Buscar tareas..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Todo estado</option>
          {COLUMNS.map(c => <option key={c} value={c}>{STATUS_LABELS[c]}</option>)}
        </select>
        <select className="input w-auto" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="all">Toda prioridad</option>
          {['urgent','high','medium','low'].map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select>
        <select className="input w-auto" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="all">Todo proyecto</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Task groups */}
      <div className="space-y-6">
        {COLUMNS.map(col => {
          const colTasks = grouped[col]
          if (colTasks.length === 0) return null
          return (
            <div key={col}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{STATUS_LABELS[col]}</span>
                <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">{colTasks.length}</span>
              </div>
              <div className="card divide-y divide-zinc-800/50">
                {colTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    projects={projects}
                    onEdit={t => setModal(t)}
                    onDelete={deleteTask}
                    onToggle={toggleDone}
                  />
                ))}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-zinc-500">
            <CheckSquare size={40} className="mx-auto mb-3 opacity-20" />
            <p>No se encontraron tareas</p>
          </div>
        )}
      </div>

      {modal !== null && (
        <Modal title={modal === 'new' ? 'Nueva tarea' : 'Editar tarea'} onClose={() => setModal(null)}>
          <TaskForm task={modal === 'new' ? null : modal} projects={projects} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}

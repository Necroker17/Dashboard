import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useDashboard } from '../context/DashboardContext'
import Modal from '../components/Modal'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, MoreHorizontal, Pencil, Trash2, Clock, Tag,
  AlertCircle, ChevronDown, X, Check, Kanban
} from 'lucide-react'

const COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: '#6b7280' },
  { id: 'todo', label: 'Por hacer', color: '#3b82f6' },
  { id: 'in_progress', label: 'En progreso', color: '#f59e0b' },
  { id: 'review', label: 'Revisión', color: '#8b5cf6' },
  { id: 'done', label: 'Hecho', color: '#22c55e' },
]

const PRIORITIES = ['urgent', 'high', 'medium', 'low']
const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }
const PRIORITY_LABELS = { urgent: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' }

function TaskCard({ task, index, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`card p-3 mb-2 cursor-grab active:cursor-grabbing transition-shadow ${snapshot.isDragging ? 'shadow-2xl shadow-violet-500/20 rotate-1' : ''}`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-zinc-200 font-medium leading-snug flex-1">{task.title}</p>
            <div className="relative flex-shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o) }}
                className="text-zinc-600 hover:text-zinc-300 p-0.5 rounded"
              >
                <MoreHorizontal size={14} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-6 z-10 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl py-1 w-32">
                  <button onClick={() => { onEdit(task); setMenuOpen(false) }} className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2">
                    <Pencil size={13} /> Editar
                  </button>
                  <button onClick={() => { onDelete(task.id); setMenuOpen(false) }} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-zinc-700 flex items-center gap-2">
                    <Trash2 size={13} /> Eliminar
                  </button>
                </div>
              )}
            </div>
          </div>
          {task.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{task.description}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {task.priority && (
              <span className="badge text-xs" style={{ backgroundColor: PRIORITY_COLORS[task.priority] + '20', color: PRIORITY_COLORS[task.priority] }}>
                {PRIORITY_LABELS[task.priority]}
              </span>
            )}
            {task.due_date && (
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <Clock size={10} />
                {task.due_date}
              </span>
            )}
            {task.tags?.length > 0 && task.tags.slice(0, 2).map(t => (
              <span key={t} className="badge bg-zinc-800 text-zinc-400 text-xs">{t}</span>
            ))}
          </div>
        </div>
      )}
    </Draggable>
  )
}

function TaskForm({ task, projects, projectId, onSave, onClose }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    due_date: task?.due_date || '',
    project_id: task?.project_id || projectId || '',
    tags: task?.tags?.join(', ') || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.title.trim()) return
    onSave({
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Título *</label>
        <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="¿Qué hay que hacer?" />
      </div>
      <div>
        <label className="label">Descripción</label>
        <textarea className="input resize-none" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Detalles opcionales..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Estado</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Prioridad</label>
          <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
            {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Fecha límite</label>
          <input type="date" className="input" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Proyecto</label>
          <select className="input" value={form.project_id} onChange={e => set('project_id', e.target.value)}>
            <option value="">Sin proyecto</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Etiquetas (separadas por coma)</label>
        <input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="diseño, backend, urgente" />
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={save} className="btn-primary flex-1 justify-center">
          <Check size={15} /> {task ? 'Actualizar' : 'Crear tarea'}
        </button>
        <button onClick={onClose} className="btn-ghost">Cancelar</button>
      </div>
    </div>
  )
}

function ProjectForm({ project, onSave, onClose }) {
  const COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777', '#0891b2']
  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    color: project?.color || '#7c3aed',
    status: project?.status || 'active',
    due_date: project?.due_date || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const save = () => { if (form.name.trim()) onSave(form) }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Nombre *</label>
        <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre del proyecto" />
      </div>
      <div>
        <label className="label">Descripción</label>
        <textarea className="input resize-none" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Estado</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="active">Activo</option>
            <option value="paused">Pausado</option>
            <option value="completed">Completado</option>
            <option value="archived">Archivado</option>
          </select>
        </div>
        <div>
          <label className="label">Fecha límite</label>
          <input type="date" className="input" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Color</label>
        <div className="flex gap-2 mt-1">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => set('color', c)}
              className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={save} className="btn-primary flex-1 justify-center">
          <Check size={15} /> {project ? 'Actualizar' : 'Crear proyecto'}
        </button>
        <button onClick={onClose} className="btn-ghost">Cancelar</button>
      </div>
    </div>
  )
}

export default function Projects() {
  const { projects, tasks, createProject, updateProject, deleteProject, createTask, updateTask, deleteTask } = useDashboard()
  const [searchParams] = useSearchParams()
  const focusId = searchParams.get('id')

  const [selectedProject, setSelectedProject] = useState(focusId || 'all')
  const [taskModal, setTaskModal] = useState(null) // null | 'new' | task object
  const [projectModal, setProjectModal] = useState(null)
  const [newTaskCol, setNewTaskCol] = useState('todo')

  useEffect(() => {
    if (focusId) setSelectedProject(focusId)
  }, [focusId])

  const filteredTasks = selectedProject === 'all'
    ? tasks
    : tasks.filter(t => t.project_id === selectedProject)

  const getColTasks = (colId) => filteredTasks.filter(t => t.status === colId)
    .sort((a, b) => (a.position || 0) - (b.position || 0))

  const onDragEnd = async ({ source, destination, draggableId }) => {
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const newStatus = destination.droppableId
    await updateTask(draggableId, { status: newStatus, position: destination.index })
  }

  const handleNewTask = (colId) => {
    setNewTaskCol(colId)
    setTaskModal('new')
  }

  const handleSaveTask = async (form) => {
    try {
      if (taskModal === 'new') {
        await createTask({ ...form, status: newTaskCol })
      } else {
        await updateTask(taskModal.id, form)
      }
      setTaskModal(null)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSaveProject = async (form) => {
    try {
      if (projectModal === 'new') {
        const p = await createProject(form)
        setSelectedProject(p.id)
      } else {
        await updateProject(projectModal.id, form)
      }
      setProjectModal(null)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Kanban size={20} className="text-zinc-400" />
          <h1 className="font-semibold text-zinc-100">Proyectos</h1>
        </div>
        <button onClick={() => setProjectModal('new')} className="btn-primary">
          <Plus size={15} /> Nuevo proyecto
        </button>
      </div>

      {/* Project tabs */}
      <div className="flex gap-1.5 px-6 py-3 border-b border-zinc-800 overflow-x-auto flex-shrink-0">
        <button
          onClick={() => setSelectedProject('all')}
          className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
            selectedProject === 'all' ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Todos
        </button>
        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedProject(p.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
              selectedProject === p.id ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || '#7c3aed' }} />
            {p.name}
            <span className="text-xs opacity-60">({tasks.filter(t => t.project_id === p.id && t.status !== 'done').length})</span>
          </button>
        ))}
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 p-6 overflow-x-auto flex-1">
          {COLUMNS.map(col => {
            const colTasks = getColTasks(col.id)
            return (
              <div key={col.id} className="flex-shrink-0 w-72">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-medium text-zinc-300">{col.label}</span>
                    <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                  </div>
                  <button onClick={() => handleNewTask(col.id)} className="text-zinc-600 hover:text-zinc-300 p-0.5 rounded transition-colors">
                    <Plus size={15} />
                  </button>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[120px] rounded-xl p-2 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-violet-600/10 border border-violet-500/30' : 'bg-zinc-900/40'
                      }`}
                    >
                      {colTasks.map((task, index) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          index={index}
                          onEdit={(t) => setTaskModal(t)}
                          onDelete={deleteTask}
                        />
                      ))}
                      {provided.placeholder}
                      <button
                        onClick={() => handleNewTask(col.id)}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-sm text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors mt-1"
                      >
                        <Plus size={13} /> Agregar tarea
                      </button>
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* Task Modal */}
      {taskModal !== null && (
        <Modal title={taskModal === 'new' ? 'Nueva tarea' : 'Editar tarea'} onClose={() => setTaskModal(null)}>
          <TaskForm
            task={taskModal === 'new' ? null : taskModal}
            projects={projects}
            projectId={selectedProject !== 'all' ? selectedProject : ''}
            onSave={handleSaveTask}
            onClose={() => setTaskModal(null)}
          />
        </Modal>
      )}

      {/* Project Modal */}
      {projectModal !== null && (
        <Modal title={projectModal === 'new' ? 'Nuevo proyecto' : 'Editar proyecto'} onClose={() => setProjectModal(null)}>
          <ProjectForm
            project={projectModal === 'new' ? null : projectModal}
            onSave={handleSaveProject}
            onClose={() => setProjectModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}

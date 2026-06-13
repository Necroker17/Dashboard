import { useState, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useDashboard } from '../context/DashboardContext'
import { Map, Info, Plus } from 'lucide-react'
import Modal from '../components/Modal'

const QUADRANTS = {
  q1: { label: 'Hacer ahora', sub: 'Urgente + Importante', color: '#ef4444', bg: 'bg-red-500/5 border-red-500/20', header: 'bg-red-500/10 text-red-400', emoji: '🔥' },
  q2: { label: 'Planificar', sub: 'Importante, no urgente', color: '#3b82f6', bg: 'bg-blue-500/5 border-blue-500/20', header: 'bg-blue-500/10 text-blue-400', emoji: '📅' },
  q3: { label: 'Delegar', sub: 'Urgente, no importante', color: '#f59e0b', bg: 'bg-amber-500/5 border-amber-500/20', header: 'bg-amber-500/10 text-amber-400', emoji: '🤝' },
  q4: { label: 'Eliminar', sub: 'Ni urgente ni importante', color: '#6b7280', bg: 'bg-zinc-700/20 border-zinc-700/40', header: 'bg-zinc-700/20 text-zinc-400', emoji: '🗑️' },
}

const PRIORITY_TO_QUADRANT = { urgent: 'q1', high: 'q2', medium: 'q3', low: 'q4' }

function QuadrantCard({ id, tasks, onMove, onQuickAdd, projects }) {
  const q = QUADRANTS[id]
  return (
    <div className={`flex flex-col rounded-xl border ${q.bg} overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-3 ${q.header}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{q.emoji}</span>
            <div>
              <div className="font-semibold text-sm">{q.label}</div>
              <div className="text-xs opacity-70">{q.sub}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-60 bg-black/20 rounded-full px-2 py-0.5">{tasks.length}</span>
            <button onClick={() => onQuickAdd(id)} className="opacity-60 hover:opacity-100 p-0.5 rounded transition-opacity">
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-3 space-y-2 min-h-[160px] transition-colors ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
          >
            {tasks.map((task, index) => {
              const project = projects.find(p => p.id === task.project_id)
              return (
                <Draggable key={task.id} draggableId={task.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 cursor-grab active:cursor-grabbing transition-all ${snapshot.isDragging ? 'shadow-lg shadow-black/50 rotate-1' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: q.color }} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium leading-snug ${task.status === 'done' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>{task.title}</p>
                          {project && <p className="text-xs text-zinc-600 mt-0.5">{project.name}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              )
            })}
            {provided.placeholder}
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center text-xs text-zinc-700 py-4">Arrastra tareas aquí</div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  )
}

export default function Eisenhower() {
  const { tasks, projects, updateTask, createTask } = useDashboard()
  const [quickAdd, setQuickAdd] = useState(null)
  const [newTitle, setNewTitle] = useState('')

  // Map tasks to quadrants
  const getQuadrant = (task) => {
    if (task.quadrant) return task.quadrant
    return PRIORITY_TO_QUADRANT[task.priority] || 'q4'
  }

  const quadrantTasks = useMemo(() => {
    const q = { q1: [], q2: [], q3: [], q4: [] }
    tasks.filter(t => t.status !== 'done').forEach(task => {
      const qid = getQuadrant(task)
      if (q[qid]) q[qid].push(task)
    })
    return q
  }, [tasks])

  const onDragEnd = async ({ source, destination, draggableId }) => {
    if (!destination || source.droppableId === destination.droppableId) return
    const newQuadrant = destination.droppableId
    const priorityMap = { q1: 'urgent', q2: 'high', q3: 'medium', q4: 'low' }
    await updateTask(draggableId, { quadrant: newQuadrant, priority: priorityMap[newQuadrant] })
  }

  const handleQuickAdd = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    const priorityMap = { q1: 'urgent', q2: 'high', q3: 'medium', q4: 'low' }
    await createTask({ title: newTitle, status: 'todo', priority: priorityMap[quickAdd], quadrant: quickAdd })
    setNewTitle('')
    setQuickAdd(null)
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <Map size={20} className="text-zinc-400" /> Matriz Eisenhower
        </h1>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Info size={14} />
          <span>Arrastra tareas entre cuadrantes para reclasificarlas</span>
        </div>
      </div>

      {/* Axes labels */}
      <div className="flex mb-1 flex-shrink-0">
        <div className="w-20 flex-shrink-0" />
        <div className="flex-1 flex">
          <div className="flex-1 text-center text-xs text-zinc-500 font-medium">⚡ Urgente</div>
          <div className="flex-1 text-center text-xs text-zinc-500 font-medium">🕐 No urgente</div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
        {/* Y axis */}
        <div className="w-6 flex flex-col justify-around items-center flex-shrink-0">
          <div className="text-xs text-zinc-500 font-medium writing-vertical-lr" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
            ⭐ Importante
          </div>
          <div className="text-xs text-zinc-500 font-medium" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
            📉 No importante
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4">
            <QuadrantCard id="q1" tasks={quadrantTasks.q1} onMove={updateTask} onQuickAdd={setQuickAdd} projects={projects} />
            <QuadrantCard id="q2" tasks={quadrantTasks.q2} onMove={updateTask} onQuickAdd={setQuickAdd} projects={projects} />
            <QuadrantCard id="q3" tasks={quadrantTasks.q3} onMove={updateTask} onQuickAdd={setQuickAdd} projects={projects} />
            <QuadrantCard id="q4" tasks={quadrantTasks.q4} onMove={updateTask} onQuickAdd={setQuickAdd} projects={projects} />
          </div>
        </DragDropContext>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mt-3 flex-shrink-0">
        {Object.entries(QUADRANTS).map(([id, q]) => (
          <div key={id} className="flex items-center gap-2 text-xs">
            <span className="text-lg">{q.emoji}</span>
            <span className="text-zinc-400">{q.label}</span>
            <span className="text-zinc-600">({quadrantTasks[id]?.length || 0})</span>
          </div>
        ))}
      </div>

      {/* Quick add modal */}
      {quickAdd && (
        <Modal title={`Nueva tarea — ${QUADRANTS[quickAdd].label}`} onClose={() => setQuickAdd(null)} size="sm">
          <form onSubmit={handleQuickAdd} className="space-y-3">
            <input autoFocus className="input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Título de la tarea" />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1 justify-center">Crear</button>
              <button type="button" onClick={() => setQuickAdd(null)} className="btn-ghost">Cancelar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

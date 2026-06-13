import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../context/DashboardContext'
import { Search, LayoutDashboard, Kanban, CheckSquare, Calendar, Target, GanttChart, Map, Brain, BarChart3, ListFilter, Settings } from 'lucide-react'

const routes = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, keywords: 'inicio home' },
  { label: 'Proyectos', path: '/projects', icon: Kanban, keywords: 'kanban board' },
  { label: 'Tareas', path: '/tasks', icon: CheckSquare, keywords: 'tasks todo' },
  { label: 'Lista', path: '/list', icon: ListFilter, keywords: 'list agrupación' },
  { label: 'Calendario', path: '/calendar', icon: Calendar, keywords: 'calendar events' },
  { label: 'Metas', path: '/goals', icon: Target, keywords: 'goals objectives' },
  { label: 'Timeline', path: '/timeline', icon: GanttChart, keywords: 'gantt timeline' },
  { label: 'Eisenhower', path: '/eisenhower', icon: Map, keywords: 'matrix priority' },
  { label: 'Mapa Mental', path: '/mindmap', icon: Brain, keywords: 'mindmap mind' },
  { label: 'Analytics', path: '/analytics', icon: BarChart3, keywords: 'analytics charts' },
  { label: 'Settings', path: '/settings', icon: Settings, keywords: 'configuración' },
]

export default function CommandMenu({ onClose }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const navigate = useNavigate()
  const { projects, tasks } = useDashboard()
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') setSelected(s => Math.min(s + 1, filtered.length - 1))
      if (e.key === 'ArrowUp') setSelected(s => Math.max(s - 1, 0))
      if (e.key === 'Enter') handleSelect(filtered[selected])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const q = query.toLowerCase()
  const filteredRoutes = routes.filter(r =>
    r.label.toLowerCase().includes(q) || r.keywords.includes(q)
  )
  const filteredProjects = q
    ? projects.filter(p => p.name.toLowerCase().includes(q)).slice(0, 4)
    : []
  const filteredTasks = q
    ? tasks.filter(t => t.title.toLowerCase().includes(q)).slice(0, 4)
    : []

  const filtered = [
    ...filteredRoutes.map(r => ({ type: 'route', ...r })),
    ...filteredProjects.map(p => ({ type: 'project', label: p.name, path: `/projects?id=${p.id}`, color: p.color, icon: Kanban })),
    ...filteredTasks.map(t => ({ type: 'task', label: t.title, path: '/tasks', icon: CheckSquare })),
  ]

  const handleSelect = (item) => {
    if (!item) return
    navigate(item.path)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search size={16} className="text-zinc-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Buscar vistas, proyectos, tareas..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
          />
          <kbd className="text-xs text-zinc-600 font-mono">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="text-center text-zinc-500 text-sm py-8">Sin resultados</div>
          )}
          {filtered.map((item, i) => {
            const Icon = item.icon
            return (
              <button
                key={i}
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  i === selected ? 'bg-violet-600/20 text-violet-300' : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {item.color
                  ? <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  : <Icon size={15} className="flex-shrink-0 text-zinc-500" />
                }
                <span>{item.label}</span>
                <span className="ml-auto text-xs text-zinc-600 capitalize">{item.type}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

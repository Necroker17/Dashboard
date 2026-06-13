import { NavLink, useLocation } from 'react-router-dom'
import { useDashboard } from '../context/DashboardContext'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard, Kanban, CheckSquare, Calendar, Target,
  GanttChart, BarChart3, Brain, ListFilter, Map, Settings,
  LogOut, Zap, ChevronDown
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Proyectos', path: '/projects', icon: Kanban },
  { label: 'Tareas', path: '/tasks', icon: CheckSquare },
  { label: 'Lista', path: '/list', icon: ListFilter },
  { label: 'Calendario', path: '/calendar', icon: Calendar },
  { label: 'Metas', path: '/goals', icon: Target },
  { divider: true, label: 'Vistas' },
  { label: 'Timeline', path: '/timeline', icon: GanttChart },
  { label: 'Eisenhower', path: '/eisenhower', icon: Map },
  { label: 'Mapa Mental', path: '/mindmap', icon: Brain },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { divider: true, label: 'Sistema' },
  { label: 'Configuración', path: '/settings', icon: Settings },
]

function NavItem({ item }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
          isActive
            ? 'bg-violet-600/20 text-violet-300 font-medium'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
        }`
      }
    >
      <Icon size={16} />
      <span>{item.label}</span>
    </NavLink>
  )
}

export default function Sidebar({ collapsed, onToggle }) {
  const { profile, projects, tasks } = useDashboard()
  const [projectsOpen, setProjectsOpen] = useState(true)

  const activeTasks = tasks.filter(t => t.status !== 'done').length
  const todayStr = new Date().toISOString().split('T')[0]
  const todayTasks = tasks.filter(t => t.due_date === todayStr && t.status !== 'done').length

  const signOut = () => supabase.auth.signOut()

  return (
    <aside className={`flex flex-col bg-zinc-900 border-r border-zinc-800 transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-zinc-800">
        <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-white" />
        </div>
        {!collapsed && <span className="font-semibold text-sm text-zinc-100">Zen Dashboard</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {navItems.map((item, i) => {
          if (item.divider) {
            return !collapsed ? (
              <div key={i} className="pt-3 pb-1 px-3">
                <span className="text-xs font-medium text-zinc-600 uppercase tracking-wider">{item.label}</span>
              </div>
            ) : <div key={i} className="my-2 border-t border-zinc-800" />
          }
          return <NavItem key={item.path} item={item} />
        })}

        {/* Projects quick list */}
        {!collapsed && projects.length > 0 && (
          <div className="pt-3">
            <button
              onClick={() => setProjectsOpen(o => !o)}
              className="flex items-center justify-between w-full px-3 py-1 text-xs font-medium text-zinc-600 uppercase tracking-wider hover:text-zinc-400"
            >
              <span>Proyectos</span>
              <ChevronDown size={12} className={`transition-transform ${projectsOpen ? '' : '-rotate-90'}`} />
            </button>
            {projectsOpen && (
              <div className="mt-1 space-y-0.5">
                {projects.slice(0, 6).map(p => (
                  <NavLink
                    key={p.id}
                    to={`/projects?id=${p.id}`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color || '#7c3aed' }}
                    />
                    <span className="truncate">{p.name}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Stats */}
      {!collapsed && (
        <div className="px-3 py-2 border-t border-zinc-800">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-zinc-800 rounded-lg px-2 py-1.5">
              <div className="text-lg font-bold text-zinc-100">{activeTasks}</div>
              <div className="text-xs text-zinc-500">Activas</div>
            </div>
            <div className="bg-zinc-800 rounded-lg px-2 py-1.5">
              <div className="text-lg font-bold text-amber-400">{todayTasks}</div>
              <div className="text-xs text-zinc-500">Hoy</div>
            </div>
          </div>
        </div>
      )}

      {/* User */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-zinc-800">
        <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
          {profile?.name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || '?'}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-zinc-200 truncate">{profile?.name || 'Usuario'}</div>
              <div className="text-xs text-zinc-500 truncate">{profile?.plan || 'free'}</div>
            </div>
            <button onClick={signOut} className="text-zinc-500 hover:text-zinc-300 p-1 rounded">
              <LogOut size={14} />
            </button>
          </>
        )}
      </div>
    </aside>
  )
}

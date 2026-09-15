import { NavLink } from 'react-router-dom'
import { useDashboard } from '../context/DashboardContext'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard, Kanban, CheckSquare, Calendar, Target,
  GanttChart, BarChart3, Brain, ListFilter, Map, Settings,
  LogOut, Zap, ChevronDown, X
} from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'

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

function NavItem({ item, collapsed }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      title={item.label}
      className={({ isActive }) =>
        // py-2.5 en móvil: 40 px de alto es el mínimo cómodo para el dedo.
        `flex items-center gap-2.5 px-3 py-2.5 md:py-2 rounded-lg text-sm transition-all duration-150 ${
          isActive
            ? 'bg-violet-600/20 text-violet-300 font-medium'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
        }`
      }
    >
      <Icon size={16} className="flex-shrink-0" />
      <span className={collapsed ? 'md:hidden' : ''}>{item.label}</span>
    </NavLink>
  )
}

export default function Sidebar({ collapsed, mobileOpen, onClose }) {
  const { profile, projects, tasks } = useDashboard()
  const [projectsOpen, setProjectsOpen] = useState(true)

  const activeTasks = tasks.filter(t => t.status !== 'done').length
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayTasks = tasks.filter(t => t.due_date === todayStr && t.status !== 'done').length

  const signOut = () => supabase.auth.signOut()

  return (
    // En móvil es un panel que se desliza SOBRE el contenido (fixed): antes se
    // quedaba en la fila y se comía 224 px de una pantalla de 375.
    // Desde md vuelve al flujo normal y solo se estrecha.
    <aside
      className={`
        fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-200 ease-out
        md:static md:z-auto md:translate-x-0 md:transition-all
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        ${collapsed ? 'md:w-14' : 'md:w-56'}
        flex flex-col bg-zinc-900 border-r border-zinc-800 flex-shrink-0
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-zinc-800">
        <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-white" />
        </div>
        <span className={`font-semibold text-sm text-zinc-100 ${collapsed ? 'md:hidden' : ''}`}>Zen Dashboard</span>
        <button
          onClick={onClose}
          className="ml-auto text-zinc-500 hover:text-zinc-300 p-1 -mr-1 rounded-lg md:hidden"
          aria-label="Cerrar menú"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {navItems.map((item, i) => {
          if (item.divider) {
            return (
              <div key={i}>
                <div className={`pt-3 pb-1 px-3 ${collapsed ? 'md:hidden' : ''}`}>
                  <span className="text-xs font-medium text-zinc-600 uppercase tracking-wider">{item.label}</span>
                </div>
                {collapsed && <div className="hidden md:block my-2 border-t border-zinc-800" />}
              </div>
            )
          }
          return <NavItem key={item.path} item={item} collapsed={collapsed} />
        })}

        {/* Projects quick list */}
        {projects.length > 0 && (
          <div className={`pt-3 ${collapsed ? 'md:hidden' : ''}`}>
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
      <div className={`px-3 py-2 border-t border-zinc-800 ${collapsed ? 'md:hidden' : ''}`}>
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

      {/* User */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-zinc-800">
        <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
          {(profile?.name || profile?.full_name)?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || '?'}
        </div>
        <div className={`flex-1 min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
          <div className="text-xs font-medium text-zinc-200 truncate">{profile?.name || profile?.full_name || 'Usuario'}</div>
          <div className="text-xs text-zinc-500 truncate">{profile?.plan || 'free'}</div>
        </div>
        <button
          onClick={signOut}
          className={`text-zinc-500 hover:text-zinc-300 p-2 md:p-1 rounded ${collapsed ? 'md:hidden' : ''}`}
          aria-label="Cerrar sesión"
        >
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  )
}

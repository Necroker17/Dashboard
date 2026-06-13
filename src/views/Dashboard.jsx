import { useDashboard } from '../context/DashboardContext'
import { format, isToday, isTomorrow, isPast, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckSquare, Target, Kanban, Flame, TrendingUp, Clock, AlertCircle, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold text-zinc-100">{value}</div>
          <div className="text-sm font-medium text-zinc-300 mt-0.5">{label}</div>
          {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

function TaskItem({ task, onDone }) {
  const priority = { urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-green-500' }
  const due = task.due_date ? new Date(task.due_date + 'T00:00:00') : null
  const overdue = due && isPast(due) && !isToday(due) && task.status !== 'done'

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-800/50 transition-colors group ${overdue ? 'border border-red-500/20' : ''}`}>
      <button
        onClick={() => onDone(task.id)}
        className="w-4 h-4 rounded-full border-2 border-zinc-600 hover:border-violet-400 mt-0.5 flex-shrink-0 transition-colors"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zinc-200">{task.title}</div>
        {task.due_date && (
          <div className={`text-xs mt-0.5 ${overdue ? 'text-red-400' : 'text-zinc-500'}`}>
            {overdue ? '⚠ Vencida · ' : ''}{format(new Date(task.due_date + 'T00:00:00'), 'd MMM', { locale: es })}
          </div>
        )}
      </div>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${priority[task.priority] || 'bg-zinc-600'}`} />
    </div>
  )
}

export default function Dashboard() {
  const { profile, projects, tasks, goals, habits, habitHistory, updateTask } = useDashboard()
  const navigate = useNavigate()
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  const activeTasks = tasks.filter(t => t.status !== 'done')
  const todayTasks = tasks.filter(t => t.due_date === todayStr && t.status !== 'done')
  const overdueTasks = activeTasks.filter(t => {
    if (!t.due_date) return false
    const d = new Date(t.due_date + 'T00:00:00')
    return isPast(d) && !isToday(d)
  })
  const weekInterval = { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) }
  const weekTasks = tasks.filter(t => t.due_date && isWithinInterval(new Date(t.due_date + 'T00:00:00'), weekInterval))
  const completedThisWeek = weekTasks.filter(t => t.status === 'done').length

  const activeGoals = goals.filter(g => g.status === 'active')
  const activeProjects = projects.filter(p => p.status === 'active')
  const todayHabits = habits.filter(h => h.is_active)
  const completedHabitsToday = todayHabits.filter(h =>
    habitHistory.find(hh => hh.habit_id === h.id && hh.date_str === todayStr && hh.completed)
  )

  const markDone = (id) => updateTask(id, { status: 'done' })

  const upcomingTasks = activeTasks
    .filter(t => t.due_date)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 8)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          Buenos días{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''} 👋
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          {format(today, "EEEE, d 'de' MMMM", { locale: es })}
          {overdueTasks.length > 0 && (
            <span className="ml-2 text-red-400">· {overdueTasks.length} {overdueTasks.length === 1 ? 'tarea vencida' : 'tareas vencidas'}</span>
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tareas hoy" value={todayTasks.length} sub={`${completedThisWeek} terminadas esta semana`} icon={CheckSquare} color="bg-violet-600/20 text-violet-400" />
        <StatCard label="Proyectos activos" value={activeProjects.length} sub={`${projects.length} total`} icon={Kanban} color="bg-blue-600/20 text-blue-400" />
        <StatCard label="Metas activas" value={activeGoals.length} sub={`${goals.filter(g => g.status === 'completed').length} completadas`} icon={Target} color="bg-green-600/20 text-green-400" />
        <StatCard label="Hábitos hoy" value={`${completedHabitsToday.length}/${todayHabits.length}`} sub="streak activos" icon={Flame} color="bg-orange-600/20 text-orange-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming tasks */}
        <div className="lg:col-span-2 card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-zinc-200 flex items-center gap-2">
              <Clock size={16} className="text-zinc-500" />
              Próximas tareas
            </h2>
            <button onClick={() => navigate('/tasks')} className="text-xs text-violet-400 hover:text-violet-300">Ver todas</button>
          </div>
          {upcomingTasks.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <CheckSquare size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay tareas pendientes</p>
              <button onClick={() => navigate('/tasks')} className="btn-primary mt-3 text-xs">
                <Plus size={14} /> Nueva tarea
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {upcomingTasks.map(t => <TaskItem key={t.id} task={t} onDone={markDone} />)}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Habits today */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-zinc-200 flex items-center gap-2">
                <Flame size={16} className="text-orange-400" />
                Hábitos de hoy
              </h2>
            </div>
            {todayHabits.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">Sin hábitos activos</p>
            ) : (
              <div className="space-y-2">
                {todayHabits.map(h => {
                  const done = habitHistory.find(hh => hh.habit_id === h.id && hh.date_str === todayStr && hh.completed)
                  return (
                    <div key={h.id} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0`} style={{ backgroundColor: h.color || '#6366f1' }} />
                      <span className={`text-sm flex-1 ${done ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>{h.name}</span>
                      {done && <span className="text-xs text-green-400">✓</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Goals progress */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-zinc-200 flex items-center gap-2">
                <TrendingUp size={16} className="text-green-400" />
                Metas
              </h2>
              <button onClick={() => navigate('/goals')} className="text-xs text-violet-400 hover:text-violet-300">Ver todas</button>
            </div>
            {activeGoals.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">Sin metas activas</p>
            ) : (
              <div className="space-y-3">
                {activeGoals.slice(0, 4).map(g => {
                  const pct = g.target_value ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0
                  return (
                    <div key={g.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300 truncate">{g.title}</span>
                        <span className="text-zinc-500 ml-2">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Projects */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-zinc-200">Proyectos</h2>
              <button onClick={() => navigate('/projects')} className="text-xs text-violet-400 hover:text-violet-300">Ver todos</button>
            </div>
            {activeProjects.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">Sin proyectos activos</p>
            ) : (
              <div className="space-y-2">
                {activeProjects.slice(0, 4).map(p => {
                  const projTasks = tasks.filter(t => t.project_id === p.id)
                  const done = projTasks.filter(t => t.status === 'done').length
                  const total = projTasks.length
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color || '#7c3aed' }} />
                      <span className="text-sm text-zinc-300 flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-zinc-500">{done}/{total}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import { useDashboard } from '../context/DashboardContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts'
import { BarChart3, TrendingUp, CheckCircle2, Clock, Target, Flame } from 'lucide-react'
import { format, subDays, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

const COLORS = ['#7c3aed', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#0891b2']
const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }
const STATUS_COLORS = { backlog: '#6b7280', todo: '#3b82f6', in_progress: '#f59e0b', review: '#8b5cf6', done: '#22c55e' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm shadow-xl">
      <div className="text-zinc-400 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill || p.stroke || p.color }} />
          <span className="text-zinc-300">{p.name}: <span className="font-medium text-zinc-100">{p.value}</span></span>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, color, trend }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-3xl font-bold text-zinc-100">{value}</div>
          <div className="text-sm font-medium text-zinc-300 mt-1">{label}</div>
          {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`text-xs mt-2 flex items-center gap-1 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          <TrendingUp size={12} className={trend < 0 ? 'rotate-180' : ''} />
          {Math.abs(trend)}% vs semana anterior
        </div>
      )}
    </div>
  )
}

export default function Analytics() {
  const { tasks, projects, goals, habits, habitHistory } = useDashboard()

  const stats = useMemo(() => {
    const done = tasks.filter(t => t.status === 'done')
    const active = tasks.filter(t => t.status !== 'done')
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')

    // Tasks by status
    const byStatus = Object.entries(
      tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc }, {})
    ).map(([name, value]) => ({ name: name.replace('_', ' '), value, fill: STATUS_COLORS[name] || '#6b7280' }))

    // Tasks by priority
    const byPriority = Object.entries(
      tasks.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc }, {})
    ).map(([name, value]) => ({ name, value, fill: PRIORITY_COLORS[name] || '#6b7280' }))

    // Tasks by project (top 6)
    const byProject = projects.slice(0, 6).map((p, i) => ({
      name: p.name.slice(0, 12),
      total: tasks.filter(t => t.project_id === p.id).length,
      done: tasks.filter(t => t.project_id === p.id && t.status === 'done').length,
      fill: p.color || COLORS[i % COLORS.length],
    })).filter(p => p.total > 0)

    // Last 14 days activity
    const last14 = Array.from({ length: 14 }, (_, i) => {
      const d = subDays(today, 13 - i)
      const ds = format(d, 'yyyy-MM-dd')
      const created = tasks.filter(t => t.created_at?.startsWith(ds)).length
      const completed = tasks.filter(t => t.updated_at?.startsWith(ds) && t.status === 'done').length
      return { day: format(d, 'EEE d', { locale: es }), creadas: created, completadas: completed }
    })

    // Goals progress
    const goalsData = goals.filter(g => g.target_value).map(g => ({
      name: g.title.slice(0, 15),
      progreso: Math.min(100, Math.round((g.current_value / g.target_value) * 100)),
    }))

    // Habit consistency (last 7 days)
    const habitConsistency = habits.slice(0, 5).map(h => {
      const days7 = Array.from({ length: 7 }, (_, i) => format(subDays(today, 6 - i), 'yyyy-MM-dd'))
      const completed = days7.filter(ds => habitHistory.find(hh => hh.habit_id === h.id && hh.date_str === ds && hh.completed)).length
      return { name: h.name.slice(0, 10), valor: Math.round((completed / 7) * 100), color: h.color || '#6366f1' }
    })

    const completionRate = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0

    return { done, active, byStatus, byPriority, byProject, last14, goalsData, habitConsistency, completionRate }
  }, [tasks, projects, goals, habits, habitHistory])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
        <BarChart3 size={20} className="text-zinc-400" /> Analytics & Progreso
      </h1>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tareas completadas" value={stats.done.length} sub={`${stats.completionRate}% tasa de completitud`} icon={CheckCircle2} color="bg-green-600/20 text-green-400" />
        <StatCard label="En progreso" value={stats.active.length} sub="tareas activas" icon={Clock} color="bg-blue-600/20 text-blue-400" />
        <StatCard label="Proyectos" value={projects.length} sub={`${projects.filter(p => p.status === 'active').length} activos`} icon={Target} color="bg-violet-600/20 text-violet-400" />
        <StatCard label="Hábitos activos" value={habits.filter(h => h.is_active).length} sub={`${goals.filter(g => g.status === 'active').length} metas activas`} icon={Flame} color="bg-orange-600/20 text-orange-400" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Activity chart */}
        <div className="md:col-span-2 card p-5">
          <h2 className="font-semibold text-zinc-200 mb-4">Actividad últimos 14 días</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.last14} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCreadas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCompletadas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="creadas" stroke="#7c3aed" fill="url(#gradCreadas)" strokeWidth={2} name="Creadas" />
              <Area type="monotone" dataKey="completadas" stroke="#22c55e" fill="url(#gradCompletadas)" strokeWidth={2} name="Completadas" />
              <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Tasks by status */}
        <div className="card p-5">
          <h2 className="font-semibold text-zinc-200 mb-4">Por estado</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={stats.byStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {stats.byStatus.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {stats.byStatus.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.fill }} />
                  {s.name}
                </span>
                <span className="text-zinc-300 font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tasks by project */}
        <div className="card p-5">
          <h2 className="font-semibold text-zinc-200 mb-4">Tareas por proyecto</h2>
          {stats.byProject.length === 0 ? (
            <div className="text-center text-zinc-500 py-8 text-sm">Sin proyectos con tareas</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.byProject} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="done" name="Completadas" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="total" name="Total" stackId="a" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Goals progress */}
        <div className="card p-5">
          <h2 className="font-semibold text-zinc-200 mb-4">Progreso de metas</h2>
          {stats.goalsData.length === 0 ? (
            <div className="text-center text-zinc-500 py-8 text-sm">Sin metas con valor objetivo</div>
          ) : (
            <div className="space-y-4">
              {stats.goalsData.map((g, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-zinc-300">{g.name}</span>
                    <span className="text-zinc-500">{g.progreso}%</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${g.progreso}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Habit consistency */}
      {stats.habitConsistency.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-zinc-200 mb-4">Consistencia de hábitos (últimos 7 días)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.habitConsistency} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="valor" name="Consistencia" radius={[4, 4, 0, 0]}>
                {stats.habitConsistency.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Priority breakdown */}
      <div className="card p-5">
        <h2 className="font-semibold text-zinc-200 mb-4">Distribución por prioridad</h2>
        <div className="grid grid-cols-4 gap-4">
          {stats.byPriority.map((p, i) => (
            <div key={i} className="rounded-xl p-4 text-center" style={{ backgroundColor: p.fill + '15', border: `1px solid ${p.fill}30` }}>
              <div className="text-2xl font-bold" style={{ color: p.fill }}>{p.value}</div>
              <div className="text-xs text-zinc-400 mt-1 capitalize">{p.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

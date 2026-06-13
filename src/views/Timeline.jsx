import { useMemo, useState } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { GanttChart, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { format, addDays, startOfWeek, differenceInDays, parseISO, isWithinInterval, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

const PRIORITY_COLORS = {
  urgent: '#ef4444', high: '#f97316', medium: '#8b5cf6', low: '#22c55e'
}
const DAY_WIDTH = 36

export default function Timeline() {
  const { tasks, projects } = useDashboard()
  const [offsetWeeks, setOffsetWeeks] = useState(0)
  const [filterProject, setFilterProject] = useState('all')
  const WEEKS = 8

  const startDate = useMemo(() => {
    const d = startOfWeek(new Date(), { weekStartsOn: 1 })
    return addDays(d, offsetWeeks * 7)
  }, [offsetWeeks])

  const days = useMemo(() => Array.from({ length: WEEKS * 7 }, (_, i) => addDays(startDate, i)), [startDate])

  const filteredTasks = useMemo(() => {
    let t = tasks.filter(task => task.due_date || task.start_date)
    if (filterProject !== 'all') t = t.filter(task => task.project_id === filterProject)
    return t
  }, [tasks, filterProject, projects])

  const taskRows = useMemo(() => {
    return filteredTasks.map(task => {
      const start = task.start_date
        ? parseISO(task.start_date)
        : task.due_date ? parseISO(task.due_date) : null
      const end = task.due_date ? parseISO(task.due_date) : start
      if (!start || !end) return null

      const project = projects.find(p => p.id === task.project_id)
      const startOffset = differenceInDays(start, startDate)
      const duration = Math.max(1, differenceInDays(end, start) + 1)

      return { task, project, start, end, startOffset, duration }
    }).filter(Boolean)
  }, [filteredTasks, startDate, projects])

  const today = startOfDay(new Date())
  const todayOffset = differenceInDays(today, startDate)

  // Group by project
  const grouped = useMemo(() => {
    const map = {}
    taskRows.forEach(row => {
      const key = row.project?.id || 'none'
      if (!map[key]) map[key] = { project: row.project, rows: [] }
      map[key].rows.push(row)
    })
    return Object.values(map)
  }, [taskRows])

  const totalWidth = days.length * DAY_WIDTH

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <GanttChart size={20} className="text-zinc-400" /> Timeline / Gantt
        </h1>
        <div className="flex items-center gap-3">
          <select className="input w-auto text-sm" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
            <option value="all">Todos los proyectos</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <button onClick={() => setOffsetWeeks(o => o - 1)} className="btn-ghost p-1.5"><ChevronLeft size={16} /></button>
            <button onClick={() => setOffsetWeeks(0)} className="btn-ghost px-3 py-1.5 text-sm">Hoy</button>
            <button onClick={() => setOffsetWeeks(o => o + 1)} className="btn-ghost p-1.5"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto card">
        {/* Day headers */}
        <div className="flex sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800">
          <div className="w-56 flex-shrink-0 px-4 py-2 text-xs font-medium text-zinc-500 border-r border-zinc-800">Tarea</div>
          <div className="flex" style={{ width: totalWidth }}>
            {days.map((d, i) => {
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              const isToday = format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
              return (
                <div
                  key={i}
                  className={`flex-shrink-0 text-center border-r border-zinc-800/50 ${isToday ? 'bg-violet-600/20' : isWeekend ? 'bg-zinc-800/30' : ''}`}
                  style={{ width: DAY_WIDTH }}
                >
                  <div className="text-xs text-zinc-600 py-1">{format(d, 'EEE', { locale: es }).slice(0, 2)}</div>
                  <div className={`text-xs pb-1 ${isToday ? 'text-violet-400 font-bold' : 'text-zinc-500'}`}>{format(d, 'd')}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Month labels */}
        <div className="flex sticky top-12 z-10 bg-zinc-900/80 border-b border-zinc-800/50">
          <div className="w-56 flex-shrink-0 border-r border-zinc-800" />
          <div className="relative" style={{ width: totalWidth, height: 20 }}>
            {days.reduce((acc, d, i) => {
              const isFirst = i === 0 || format(d, 'MM') !== format(days[i - 1], 'MM')
              if (isFirst) acc.push({ day: d, offset: i })
              return acc
            }, []).map(({ day, offset }) => (
              <div
                key={offset}
                className="absolute text-xs text-zinc-600 top-1"
                style={{ left: offset * DAY_WIDTH + 4 }}
              >
                {format(day, 'MMMM yyyy', { locale: es })}
              </div>
            ))}
          </div>
        </div>

        {/* Today line */}
        <div className="relative">
          {todayOffset >= 0 && todayOffset < days.length && (
            <div
              className="absolute top-0 bottom-0 w-px bg-violet-500 z-20 pointer-events-none"
              style={{ left: 224 + todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
            />
          )}

          {/* Rows */}
          {grouped.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <GanttChart size={40} className="mx-auto mb-3 opacity-20" />
              <p>No hay tareas con fechas para mostrar</p>
              <p className="text-xs mt-1">Agrega fechas de inicio y vencimiento a tus tareas</p>
            </div>
          ) : (
            grouped.map((group, gi) => (
              <div key={gi}>
                {/* Project header */}
                <div className="flex border-b border-zinc-800/50 bg-zinc-900/50">
                  <div className="w-56 flex-shrink-0 px-4 py-2 border-r border-zinc-800">
                    <div className="flex items-center gap-2">
                      {group.project ? (
                        <>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.project.color || '#7c3aed' }} />
                          <span className="text-xs font-semibold text-zinc-300">{group.project.name}</span>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-zinc-500">Sin proyecto</span>
                      )}
                    </div>
                  </div>
                  <div style={{ width: totalWidth }} className="h-8" />
                </div>

                {/* Task rows */}
                {group.rows.map((row, ri) => (
                  <div key={row.task.id} className="flex border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors" style={{ height: 36 }}>
                    <div className="w-56 flex-shrink-0 px-4 flex items-center border-r border-zinc-800">
                      <span className="text-xs text-zinc-400 truncate">{row.task.title}</span>
                    </div>
                    <div className="relative flex-shrink-0" style={{ width: totalWidth, height: 36 }}>
                      {/* Weekend backgrounds */}
                      {days.map((d, i) => {
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6
                        return isWeekend ? (
                          <div key={i} className="absolute top-0 bottom-0 bg-zinc-800/20" style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }} />
                        ) : null
                      })}

                      {/* Task bar */}
                      {row.startOffset < days.length && row.startOffset + row.duration > 0 && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded-md flex items-center px-2 text-xs text-white font-medium overflow-hidden"
                          style={{
                            left: Math.max(0, row.startOffset) * DAY_WIDTH,
                            width: Math.min(row.duration, days.length - Math.max(0, row.startOffset)) * DAY_WIDTH - 2,
                            height: 22,
                            backgroundColor: PRIORITY_COLORS[row.task.priority] || '#7c3aed',
                            opacity: row.task.status === 'done' ? 0.5 : 1,
                          }}
                          title={`${row.task.title} | ${row.task.status}`}
                        >
                          <span className="truncate">{row.task.title}</span>
                          {row.task.status === 'done' && <span className="ml-1 opacity-80">✓</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
        {Object.entries(PRIORITY_COLORS).map(([p, c]) => (
          <span key={p} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: c }} />
            {p}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-0.5 h-4 bg-violet-500 rounded" />
          Hoy
        </span>
      </div>
    </div>
  )
}

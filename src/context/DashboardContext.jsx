import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const Ctx = createContext(null)
export const useDashboard = () => useContext(Ctx)

// Postgres rejects '' for date/numeric/uuid columns, and an empty foreign key
// fails its constraint. Forms send '' for every field left blank, so normalise
// to null before any insert/update.
const clean = (obj) =>
  Object.fromEntries(
    Object.entries(obj ?? {}).map(([k, v]) => [k, v === '' ? null : v])
  )

export function DashboardProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [profile, setProfile] = useState(null)
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [goals, setGoals] = useState([])
  const [habits, setHabits] = useState([])
  const [habitHistory, setHabitHistory] = useState([])
  const [calendarEvents, setCalendarEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [aiSessions, setAiSessions] = useState([])
  const [loading, setLoading] = useState(true)

  // Auth. Keep the user object identity stable across token refreshes so the
  // loader below doesn't re-run and tear the whole tree down every hour.
  useEffect(() => {
    const apply = (session) => {
      const next = session?.user ?? null
      setUser(prev => (prev?.id === next?.id ? prev : next))
      setAuthReady(true)
    }
    supabase.auth.getSession().then(({ data: { session } }) => apply(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => apply(session))
    return () => subscription.unsubscribe()
  }, [])

  // Load all data once auth has actually resolved. Deciding before getSession()
  // returns is what made the login screen flash on every reload.
  useEffect(() => {
    if (!authReady) return
    if (!user) { setLoading(false); return }
    loadAll()
    // user?.id a propósito, no el objeto user: con el objeto completo, cada
    // refresco de token remontaba toda la aplicación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user?.id])

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError('')
    try {
      const results = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('position', { ascending: true }),
        supabase.from('goals').select('*').order('created_at', { ascending: false }),
        supabase.from('habits').select('*').order('created_at', { ascending: false }),
        supabase.from('habit_history').select('*'),
        supabase.from('calendar_events').select('*').order('start_datetime'),
        supabase.from('categories').select('*'),
        supabase.from('ai_sessions').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
      ])
      const [
        { data: p }, { data: t }, { data: g },
        { data: h }, { data: hh }, { data: ce },
        { data: cats }, { data: sess }, { data: prof },
      ] = results

      // Don't swallow failures: an RLS rejection or a network blip used to look
      // exactly like "you have no data yet".
      const errs = results.map(r => r.error).filter(Boolean)
      if (errs.length) setLoadError(errs.map(e => e.message).join(' · '))

      setProjects(p || [])
      setTasks(t || [])
      setGoals(g || [])
      setHabits(h || [])
      setHabitHistory(hh || [])
      setCalendarEvents(ce || [])
      setCategories(cats || [])
      setAiSessions(sess || [])
      setProfile(prof || null)
    } finally {
      setLoading(false)
    }
  }, [user])

  // PROJECTS CRUD
  const createProject = async (data) => {
    const proj = { ...clean(data), id: crypto.randomUUID(), user_id: user.id }
    const { data: d, error } = await supabase.from('projects').insert(proj).select().single()
    if (error) throw error
    setProjects(prev => [d, ...prev])
    return d
  }
  const updateProject = async (id, data) => {
    const { data: d, error } = await supabase.from('projects').update({ ...clean(data), updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id).select().single()
    if (error) throw error
    setProjects(prev => prev.map(p => p.id === id ? d : p))
    return d
  }
  const deleteProject = async (id) => {
    const { error } = await supabase.from('projects').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    setProjects(prev => prev.filter(p => p.id !== id))
    // La clave foránea es ON DELETE SET NULL: las tareas sobreviven sin proyecto.
    // Antes se filtraban del estado local y reaparecían al recargar, con un
    // project_id colgante que no encajaba en ningún grupo de la vista Lista.
    setTasks(prev => prev.map(t => t.project_id === id ? { ...t, project_id: null } : t))
  }

  // TASKS CRUD
  const createTask = async (data) => {
    const task = { position: tasks.length, ...clean(data), id: crypto.randomUUID(), user_id: user.id }
    const { data: d, error } = await supabase.from('tasks').insert(task).select().single()
    if (error) throw error
    setTasks(prev => [...prev, d])
    return d
  }
  const updateTask = async (id, data) => {
    const { data: d, error } = await supabase.from('tasks').update({ ...clean(data), updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id).select().single()
    if (error) throw error
    setTasks(prev => prev.map(t => t.id === id ? d : t))
    return d
  }
  const deleteTask = async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    setTasks(prev => prev.filter(t => t.id !== id))
  }
  // Reordenar NO es editar: updateTask estampa updated_at, y Analytics deriva de
  // ese campo el historial de completadas. Renumerar una columna de 20 tarjetas
  // con updateTask les ponía a las 20 la fecha de hoy y borraba las reales.
  // Aquí solo se escriben las filas que de verdad cambian, y sin tocar updated_at.
  const reorderTasks = async (updates) => {
    const changed = updates.filter(u => {
      const current = tasks.find(t => t.id === u.id)
      return current && (current.position !== u.position || current.status !== u.status)
    })
    if (changed.length === 0) return

    // Optimista primero: el tablero no debe esperar a la red para verse bien.
    const snapshot = tasks
    setTasks(prev => prev.map(t => {
      const u = changed.find(c => c.id === t.id)
      return u ? { ...t, position: u.position, status: u.status } : t
    }))

    const results = await Promise.all(
      changed.map(u =>
        supabase.from('tasks')
          .update({ position: u.position, status: u.status })
          .eq('id', u.id).eq('user_id', user.id)
      )
    )
    const failed = results.find(r => r.error)
    if (failed) {
      setTasks(snapshot)  // revertir: el orden mostrado nunca llegó a la base
      throw failed.error
    }
  }

  const bulkCreateTasks = async (taskList) => {
    const { data: d, error } = await supabase.from('tasks').insert(taskList.map(t => ({ ...clean(t), user_id: user.id }))).select()
    if (error) throw error
    setTasks(prev => [...prev, ...d])
    return d
  }

  // GOALS CRUD
  const createGoal = async (data) => {
    const { data: d, error } = await supabase.from('goals').insert({ ...clean(data), user_id: user.id }).select().single()
    if (error) throw error
    setGoals(prev => [d, ...prev])
    return d
  }
  const updateGoal = async (id, data) => {
    const { data: d, error } = await supabase.from('goals').update({ ...clean(data), updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id).select().single()
    if (error) throw error
    setGoals(prev => prev.map(g => g.id === id ? d : g))
    return d
  }
  const deleteGoal = async (id) => {
    const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  // HABITS CRUD
  const createHabit = async (data) => {
    const habit = { ...clean(data), id: crypto.randomUUID(), user_id: user.id }
    const { data: d, error } = await supabase.from('habits').insert(habit).select().single()
    if (error) throw error
    setHabits(prev => [d, ...prev])
    return d
  }
  const toggleHabit = async (habitId, dateStr) => {
    const existing = habitHistory.find(h => h.habit_id === habitId && h.date_str === dateStr)
    if (existing) {
      const newCompleted = !existing.completed
      const { data: d, error } = await supabase.from('habit_history').update({ completed: newCompleted }).eq('id', existing.id).select().single()
      if (error) throw error
      setHabitHistory(prev => prev.map(h => h.id === existing.id ? d : h))
    } else {
      const { data: d, error } = await supabase.from('habit_history').insert({ user_id: user.id, habit_id: habitId, date_str: dateStr, completed: true }).select().single()
      if (error) throw error
      setHabitHistory(prev => [...prev, d])
    }
  }
  const deleteHabit = async (id) => {
    const { error } = await supabase.from('habits').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    setHabits(prev => prev.filter(h => h.id !== id))
  }

  // CALENDAR EVENTS CRUD
  const createEvent = async (data) => {
    const { data: d, error } = await supabase.from('calendar_events').insert({ ...clean(data), user_id: user.id }).select().single()
    if (error) throw error
    setCalendarEvents(prev => [...prev, d])
    return d
  }
  const updateEvent = async (id, data) => {
    const { data: d, error } = await supabase.from('calendar_events').update({ ...clean(data), updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id).select().single()
    if (error) throw error
    setCalendarEvents(prev => prev.map(e => e.id === id ? d : e))
    return d
  }
  const deleteEvent = async (id) => {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    setCalendarEvents(prev => prev.filter(e => e.id !== id))
  }

  // AI SESSIONS
  const saveAiSession = async (data) => {
    const { data: d, error } = await supabase.from('ai_sessions').upsert({ ...clean(data), user_id: user.id }).select().single()
    if (error) throw error
    setAiSessions(prev => {
      const idx = prev.findIndex(s => s.id === d.id)
      return idx >= 0 ? prev.map(s => s.id === d.id ? d : s) : [d, ...prev]
    })
    return d
  }

  // PROFILE
  const updateProfile = async (data) => {
    const { data: d, error } = await supabase.from('profiles').update({ ...clean(data), updated_at: new Date().toISOString() }).eq('id', user.id).select().single()
    if (error) throw error
    setProfile(d)
    return d
  }

  return (
    <Ctx.Provider value={{
      user, profile, loading, loadError,
      projects, tasks, goals, habits, habitHistory, calendarEvents, categories, aiSessions,
      createProject, updateProject, deleteProject,
      createTask, updateTask, deleteTask, bulkCreateTasks, reorderTasks,
      createGoal, updateGoal, deleteGoal,
      createHabit, toggleHabit, deleteHabit,
      createEvent, updateEvent, deleteEvent,
      saveAiSession,
      updateProfile,
      reload: loadAll,
    }}>
      {children}
    </Ctx.Provider>
  )
}

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const Ctx = createContext(null)
export const useDashboard = () => useContext(Ctx)

export function DashboardProvider({ children }) {
  const [user, setUser] = useState(null)
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

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load all data when user is authenticated
  useEffect(() => {
    if (!user) { setLoading(false); return }
    loadAll()
  }, [user])

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [
        { data: p }, { data: t }, { data: g },
        { data: h }, { data: hh }, { data: ce },
        { data: cats }, { data: sess }, { data: prof },
      ] = await Promise.all([
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
    const proj = { id: `proj-${Date.now()}`, user_id: user.id, ...data }
    const { data: d, error } = await supabase.from('projects').insert(proj).select().single()
    if (error) throw error
    setProjects(prev => [d, ...prev])
    return d
  }
  const updateProject = async (id, data) => {
    const { data: d, error } = await supabase.from('projects').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) throw error
    setProjects(prev => prev.map(p => p.id === id ? d : p))
    return d
  }
  const deleteProject = async (id) => {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw error
    setProjects(prev => prev.filter(p => p.id !== id))
    setTasks(prev => prev.filter(t => t.project_id !== id))
  }

  // TASKS CRUD
  const createTask = async (data) => {
    const task = { id: `task-${Date.now()}`, user_id: user.id, position: tasks.length, ...data }
    const { data: d, error } = await supabase.from('tasks').insert(task).select().single()
    if (error) throw error
    setTasks(prev => [...prev, d])
    return d
  }
  const updateTask = async (id, data) => {
    const { data: d, error } = await supabase.from('tasks').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) throw error
    setTasks(prev => prev.map(t => t.id === id ? d : t))
    return d
  }
  const deleteTask = async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
    setTasks(prev => prev.filter(t => t.id !== id))
  }
  const bulkCreateTasks = async (taskList) => {
    const { data: d, error } = await supabase.from('tasks').insert(taskList).select()
    if (error) throw error
    setTasks(prev => [...prev, ...d])
    return d
  }

  // GOALS CRUD
  const createGoal = async (data) => {
    const { data: d, error } = await supabase.from('goals').insert({ user_id: user.id, ...data }).select().single()
    if (error) throw error
    setGoals(prev => [d, ...prev])
    return d
  }
  const updateGoal = async (id, data) => {
    const { data: d, error } = await supabase.from('goals').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) throw error
    setGoals(prev => prev.map(g => g.id === id ? d : g))
    return d
  }
  const deleteGoal = async (id) => {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) throw error
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  // HABITS CRUD
  const createHabit = async (data) => {
    const habit = { id: `habit-${Date.now()}`, user_id: user.id, ...data }
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
    const { error } = await supabase.from('habits').delete().eq('id', id)
    if (error) throw error
    setHabits(prev => prev.filter(h => h.id !== id))
  }

  // CALENDAR EVENTS CRUD
  const createEvent = async (data) => {
    const { data: d, error } = await supabase.from('calendar_events').insert({ user_id: user.id, ...data }).select().single()
    if (error) throw error
    setCalendarEvents(prev => [...prev, d])
    return d
  }
  const updateEvent = async (id, data) => {
    const { data: d, error } = await supabase.from('calendar_events').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) throw error
    setCalendarEvents(prev => prev.map(e => e.id === id ? d : e))
    return d
  }
  const deleteEvent = async (id) => {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)
    if (error) throw error
    setCalendarEvents(prev => prev.filter(e => e.id !== id))
  }

  // AI SESSIONS
  const saveAiSession = async (data) => {
    const { data: d, error } = await supabase.from('ai_sessions').upsert({ user_id: user.id, ...data }).select().single()
    if (error) throw error
    setAiSessions(prev => {
      const idx = prev.findIndex(s => s.id === d.id)
      return idx >= 0 ? prev.map(s => s.id === d.id ? d : s) : [d, ...prev]
    })
    return d
  }

  // PROFILE
  const updateProfile = async (data) => {
    const { data: d, error } = await supabase.from('profiles').update({ ...data, updated_at: new Date().toISOString() }).eq('id', user.id).select().single()
    if (error) throw error
    setProfile(d)
    return d
  }

  return (
    <Ctx.Provider value={{
      user, profile, loading,
      projects, tasks, goals, habits, habitHistory, calendarEvents, categories, aiSessions,
      createProject, updateProject, deleteProject,
      createTask, updateTask, deleteTask, bulkCreateTasks,
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

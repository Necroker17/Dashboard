import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DashboardProvider, useDashboard } from './context/DashboardContext'
import Layout from './components/Layout'
import Auth from './views/Auth'
import Dashboard from './views/Dashboard'
import Projects from './views/Projects'
import Tasks from './views/Tasks'
import CalendarView from './views/CalendarView'
import Goals from './views/Goals'
import Settings from './views/Settings'
import Timeline from './views/Timeline'
import Eisenhower from './views/Eisenhower'
import MindMap from './views/MindMap'
import Analytics from './views/Analytics'
import ListView from './views/ListView'

function AppRoutes() {
  const { user, loading } = useDashboard()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-zinc-400 text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) return <Auth />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/eisenhower" element={<Eisenhower />} />
        <Route path="/mindmap" element={<MindMap />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/list" element={<ListView />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
        <AppRoutes />
      </DashboardProvider>
    </BrowserRouter>
  )
}

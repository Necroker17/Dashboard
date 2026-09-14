import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DashboardProvider, useDashboard } from './context/DashboardContext'
import { missingEnv } from './lib/supabase'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Auth from './views/Auth'
import Dashboard from './views/Dashboard'
import Projects from './views/Projects'
import Tasks from './views/Tasks'
import Goals from './views/Goals'
import ListView from './views/ListView'
import Settings from './views/Settings'

// Las vistas pesadas (React Flow, Recharts, react-big-calendar) se cargan solo
// cuando se visitan: antes se descargaban todas antes de pintar el login.
const CalendarView = lazy(() => import('./views/CalendarView'))
const Timeline = lazy(() => import('./views/Timeline'))
const Eisenhower = lazy(() => import('./views/Eisenhower'))
const MindMap = lazy(() => import('./views/MindMap'))
const Analytics = lazy(() => import('./views/Analytics'))

function Spinner({ label = 'Cargando...' }) {
  return (
    <div className="flex h-full min-h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-zinc-400 text-sm">{label}</span>
      </div>
    </div>
  )
}

function EnvError() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full card p-6">
        <h1 className="font-semibold text-zinc-100 mb-2">Falta configuración</h1>
        <p className="text-sm text-zinc-400 mb-4">
          No encuentro las variables de entorno de Supabase, así que la aplicación no puede
          conectarse. Defínelas en Vercel (o en un <code className="text-zinc-300">.env.local</code> si
          estás en local) y vuelve a desplegar:
        </p>
        <pre className="text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-lg p-3 overflow-x-auto">
{`VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...`}
        </pre>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { user, loading, loadError } = useDashboard()

  if (loading) return <div className="h-screen bg-zinc-950"><Spinner /></div>
  if (!user) return <Auth />

  return (
    <Layout>
      {loadError && (
        <div className="mx-6 mt-4 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          No se pudieron cargar algunos datos: {loadError}
        </div>
      )}
      <Suspense fallback={<Spinner />}>
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
      </Suspense>
    </Layout>
  )
}

export default function App() {
  if (missingEnv) return <EnvError />

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <DashboardProvider>
          <AppRoutes />
        </DashboardProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

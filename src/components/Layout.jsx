import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import CommandMenu from './CommandMenu'
import AIAssistant from './AIAssistant'
import { Menu, Bot, Search } from 'lucide-react'

export default function Layout({ children }) {
  // Dos conceptos distintos: en móvil el menú se desliza sobre el contenido;
  // en escritorio se queda en la fila y solo se estrecha.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const location = useLocation()

  // Al navegar, el menú móvil se cierra solo: si no, tapa la pantalla a la que
  // acabas de entrar.
  useEffect(() => { setMobileNavOpen(false) }, [location.pathname])

  // Con el menú o el asistente abiertos en móvil, el fondo no debe desplazarse.
  useEffect(() => {
    const lock = mobileNavOpen || aiOpen
    document.body.style.overflow = lock ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileNavOpen, aiOpen])

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(o => !o)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault()
        setAiOpen(o => !o)
      }
      if (e.key === 'Escape') {
        setMobileNavOpen(false)
        setAiOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    // dvh en vez de vh: en el móvil, 100vh incluye el alto de la barra del
    // navegador, así que el contenido quedaba cortado por abajo.
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Fondo oscuro tras el menú móvil */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
          {/* En móvil abre el menú deslizante; en escritorio lo estrecha. */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="text-zinc-400 hover:text-zinc-200 p-2 -ml-1 rounded-lg transition-colors md:hidden"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <button
            onClick={() => setCollapsed(o => !o)}
            className="hidden md:block text-zinc-500 hover:text-zinc-300 p-1 rounded transition-colors"
            aria-label="Contraer menú"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-2 sm:py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-400 hover:text-zinc-300 transition-all"
              aria-label="Buscar"
            >
              <Search size={15} className="sm:hidden" />
              <span className="hidden sm:inline">Buscar...</span>
              <kbd className="hidden sm:inline text-xs bg-zinc-700 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
            </button>
            <button
              onClick={() => setAiOpen(o => !o)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium transition-all ${
                aiOpen ? 'bg-violet-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <Bot size={16} />
              <span className="hidden xs:inline sm:inline">IA</span>
              <kbd className="hidden sm:inline text-xs opacity-60 font-mono">⌘I</kbd>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex min-w-0">
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
            {children}
          </div>

          {/* Asistente: pantalla completa en móvil, panel lateral en escritorio. */}
          {aiOpen && (
            <>
              <div
                className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm hidden md:block"
                onClick={() => setAiOpen(false)}
              />
              <div className="fixed inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-[420px] md:border-l border-zinc-800 z-40 shadow-2xl bg-zinc-950">
                <AIAssistant onClose={() => setAiOpen(false)} />
              </div>
            </>
          )}
        </main>
      </div>

      {cmdOpen && <CommandMenu onClose={() => setCmdOpen(false)} />}
    </div>
  )
}

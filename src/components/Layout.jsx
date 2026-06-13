import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import CommandMenu from './CommandMenu'
import AIAssistant from './AIAssistant'
import { Menu, Bot } from 'lucide-react'

export default function Layout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

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
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(o => !o)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
          <button
            onClick={() => setSidebarCollapsed(o => !o)}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded transition-colors"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-400 hover:text-zinc-300 transition-all"
            >
              <span>Buscar...</span>
              <kbd className="text-xs bg-zinc-700 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
            </button>
            <button
              onClick={() => setAiOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                aiOpen ? 'bg-violet-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <Bot size={15} />
              <span>IA</span>
              <kbd className="text-xs opacity-60 font-mono">⌘I</kbd>
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>

          {/* AI Panel */}
          {aiOpen && (
            <div className="w-80 border-l border-zinc-800 flex-shrink-0">
              <AIAssistant onClose={() => setAiOpen(false)} />
            </div>
          )}
        </main>
      </div>

      {cmdOpen && <CommandMenu onClose={() => setCmdOpen(false)} />}
    </div>
  )
}

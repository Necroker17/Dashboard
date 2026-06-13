import { useState, useRef, useEffect } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { sendMessage, tryParseplan, planToTasks } from '../lib/claude'
import { Bot, Send, X, Sparkles, CheckCircle2, Loader2, Plus } from 'lucide-react'

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

function PlanPreview({ plan, onImport, importing }) {
  return (
    <div className="bg-zinc-800 rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm text-zinc-100">{plan.project_name}</div>
          <div className="text-xs text-zinc-400 mt-0.5">{plan.estimated_duration}</div>
        </div>
        <button
          onClick={onImport}
          disabled={importing}
          className="btn-primary text-xs py-1 flex-shrink-0"
        >
          {importing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Importar
        </button>
      </div>
      <p className="text-xs text-zinc-400">{plan.summary}</p>
      <div className="space-y-1">
        {plan.tasks.map((t, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
              t.priority === 'urgent' ? 'bg-red-500' :
              t.priority === 'high' ? 'bg-orange-500' :
              t.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
            }`} />
            <span className="text-zinc-300">{t.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AIAssistant({ onClose }) {
  const { user, projects, bulkCreateTasks, createProject, saveAiSession } = useDashboard()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy tu asistente IA. Cuéntame sobre un proyecto o tarea que quieras planificar y lo convertiré en tareas ejecutables en tu Kanban.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [importingIdx, setImportingIdx] = useState(null)
  const [selectedProject, setSelectedProject] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)

    try {
      const text = await sendMessage(newMsgs, ANTHROPIC_KEY)
      const plan = tryParseplan(text)
      const assistantMsg = { role: 'assistant', content: text, plan }
      const finalMsgs = [...newMsgs, assistantMsg]
      setMessages(finalMsgs)

      // Save session
      const session = await saveAiSession({
        id: sessionId || undefined,
        title: userMsg.content.slice(0, 50),
        messages: finalMsgs.map(m => ({ role: m.role, content: m.content })),
        model: 'claude-sonnet-4-6',
      })
      setSessionId(session.id)
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}. Verifica que VITE_ANTHROPIC_API_KEY esté configurada correctamente.`
      }])
    } finally {
      setLoading(false)
    }
  }

  const importPlan = async (plan, msgIdx) => {
    setImportingIdx(msgIdx)
    try {
      let projectId = selectedProject
      if (!projectId) {
        const proj = await createProject({
          name: plan.project_name,
          description: plan.description || '',
          color: '#7c3aed',
          status: 'active',
        })
        projectId = proj.id
      }
      const taskList = planToTasks(plan, user.id, projectId)
      await bulkCreateTasks(taskList)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ Plan importado: ${taskList.length} tareas creadas${projectId !== selectedProject ? ` en el nuevo proyecto "${plan.project_name}"` : ''}.`
      }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error al importar: ${err.message}` }])
    } finally {
      setImportingIdx(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-violet-600 rounded-lg flex items-center justify-center">
            <Sparkles size={12} className="text-white" />
          </div>
          <span className="text-sm font-medium text-zinc-200">Asistente IA</span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1 rounded">
          <X size={16} />
        </button>
      </div>

      {/* Project selector */}
      {projects.length > 0 && (
        <div className="px-3 py-2 border-b border-zinc-800">
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-300 outline-none"
          >
            <option value="">Crear nuevo proyecto</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] ${msg.role === 'user' ? 'order-1' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1">
                  <Bot size={12} className="text-violet-400" />
                  <span className="text-xs text-zinc-500">IA</span>
                </div>
              )}
              <div className={`rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-sm'
                  : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
              }`}>
                {msg.plan ? (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-300">He generado un plan ejecutable:</p>
                    <PlanPreview
                      plan={msg.plan}
                      onImport={() => importPlan(msg.plan, i)}
                      importing={importingIdx === i}
                    />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <Loader2 size={12} className="animate-spin text-violet-400" />
            Generando plan...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-800">
        {!ANTHROPIC_KEY && (
          <div className="text-xs text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2 mb-2">
            Agrega VITE_ANTHROPIC_API_KEY a tu .env
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Describe tu proyecto o tarea..."
            rows={2}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="btn-primary self-end"
          >
            <Send size={14} />
          </button>
        </div>
        <div className="text-xs text-zinc-600 mt-1.5">Enter para enviar · Shift+Enter para salto de línea</div>
      </div>
    </div>
  )
}

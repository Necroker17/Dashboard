import { useState, useRef, useEffect } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { sendMessage, tryParsePlan, planToTasks, PROVIDERS } from '../lib/ai'
import { Bot, Send, X, Sparkles, Loader2, Plus, ChevronDown, ExternalLink } from 'lucide-react'

const ENV_KEYS = {
  groq:      import.meta.env.VITE_GROQ_API_KEY,
  anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY,
  gemini:    import.meta.env.VITE_GEMINI_API_KEY,
  openai:    import.meta.env.VITE_OPENAI_API_KEY,
}

// Detect which providers are configured
const CONFIGURED = Object.fromEntries(
  Object.entries(ENV_KEYS).map(([k, v]) => [k, !!v])
)

const DEFAULT_PROVIDER = Object.keys(CONFIGURED).find(k => CONFIGURED[k]) || 'groq'

function PlanPreview({ plan, onImport, importing }) {
  const PCOLORS = { urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-green-500' }
  return (
    <div className="bg-zinc-800 rounded-xl p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm text-zinc-100">{plan.project_name}</div>
          <div className="text-xs text-zinc-400 mt-0.5">{plan.estimated_duration} · {plan.tasks.length} tareas</div>
        </div>
        <button onClick={onImport} disabled={importing} className="btn-primary text-xs py-1 flex-shrink-0">
          {importing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Importar
        </button>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">{plan.summary}</p>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {plan.tasks.map((t, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${PCOLORS[t.priority] || 'bg-zinc-500'}`} />
            <span className="text-zinc-300">{t.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProviderSelector({ provider, model, onChangeProvider, onChangeModel }) {
  const [open, setOpen] = useState(false)
  const p = PROVIDERS[provider]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition-colors w-full"
      >
        <span className="font-medium text-zinc-200">{p.name}</span>
        <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: p.color + '30', color: p.color }}>{p.badge}</span>
        <span className="text-zinc-500 flex-1 text-left truncate">{p.models.find(m => m.id === model)?.label || model}</span>
        {!CONFIGURED[provider] && <span className="text-amber-400 text-xs">sin key</span>}
        <ChevronDown size={12} className={`text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-20 overflow-hidden">
          {Object.entries(PROVIDERS).map(([pid, prov]) => (
            <div key={pid}>
              <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-300">{prov.name}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: prov.color + '30', color: prov.color }}>{prov.badge}</span>
                </div>
                {!CONFIGURED[pid] ? (
                  <a href={prov.signupUrl} target="_blank" rel="noreferrer" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                    Obtener key <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="text-xs text-green-400">✓ configurado</span>
                )}
              </div>
              {prov.models.map(m => (
                <button
                  key={m.id}
                  onClick={() => { onChangeProvider(pid); onChangeModel(m.id); setOpen(false) }}
                  disabled={!CONFIGURED[pid]}
                  className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center justify-between ${
                    provider === pid && model === m.id
                      ? 'bg-violet-600/20 text-violet-300'
                      : CONFIGURED[pid]
                        ? 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                        : 'text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  {m.label}
                  {provider === pid && model === m.id && <span className="text-violet-400">✓</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AIAssistant({ onClose }) {
  const { user, projects, bulkCreateTasks, createProject, saveAiSession } = useDashboard()
  const [provider, setProvider] = useState(DEFAULT_PROVIDER)
  const [model, setModel] = useState(PROVIDERS[DEFAULT_PROVIDER].models[0].id)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy tu asistente IA. Cuéntame sobre un proyecto y lo convierte en tareas ejecutables en tu Kanban. Puedes cambiar el modelo arriba.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [importingIdx, setImportingIdx] = useState(null)
  const [selectedProject, setSelectedProject] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Keep default model in sync when provider changes
  const handleChangeProvider = (pid) => {
    setProvider(pid)
    setModel(PROVIDERS[pid].models[0].id)
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const apiKey = ENV_KEYS[provider]
    if (!apiKey) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Configura la API key de ${PROVIDERS[provider].name} en Vercel:\nVariable: \`${PROVIDERS[provider].envKey}\`\nObtenerla en: ${PROVIDERS[provider].signupUrl}`
      }])
      return
    }

    const userMsg = { role: 'user', content: input.trim() }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)

    try {
      const text = await sendMessage(newMsgs, provider, model, apiKey)
      const plan = tryParsePlan(text)
      const assistantMsg = { role: 'assistant', content: text, plan }
      const finalMsgs = [...newMsgs, assistantMsg]
      setMessages(finalMsgs)

      const session = await saveAiSession({
        id: sessionId || undefined,
        title: userMsg.content.slice(0, 50),
        messages: finalMsgs.map(m => ({ role: m.role, content: m.content })),
        model: `${provider}/${model}`,
      })
      setSessionId(session.id)
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Error: ${err.message}`
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
        content: `✅ ${taskList.length} tareas importadas${selectedProject ? '' : ` al nuevo proyecto "${plan.project_name}"`}.`
      }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error al importar: ${err.message}` }])
    } finally {
      setImportingIdx(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
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

      {/* Model selector */}
      <div className="px-3 py-2 border-b border-zinc-800 flex-shrink-0">
        <ProviderSelector
          provider={provider}
          model={model}
          onChangeProvider={handleChangeProvider}
          onChangeModel={setModel}
        />
      </div>

      {/* Project selector */}
      {projects.length > 0 && (
        <div className="px-3 py-2 border-b border-zinc-800 flex-shrink-0">
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-300 outline-none"
          >
            <option value="">Crear nuevo proyecto automáticamente</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[92%]">
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1">
                  <Bot size={12} className="text-violet-400" />
                  <span className="text-xs text-zinc-500">{PROVIDERS[provider]?.name || 'IA'}</span>
                </div>
              )}
              <div className={`rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-sm'
                  : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
              }`}>
                {msg.plan ? (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-300">Plan generado:</p>
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
            <span>{PROVIDERS[provider]?.name} pensando...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-800 flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Describe tu proyecto o tarea..."
            rows={2}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-violet-500"
          />
          <button onClick={send} disabled={loading || !input.trim()} className="btn-primary self-end">
            <Send size={14} />
          </button>
        </div>
        <div className="text-xs text-zinc-600 mt-1.5">Enter enviar · Shift+Enter salto</div>
      </div>
    </div>
  )
}

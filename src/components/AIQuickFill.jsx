import { useState } from 'react'
import { Sparkles, Loader2, X } from 'lucide-react'
import { extractTaskFromText, PROVIDERS } from '../lib/ai'

const ENV_KEYS = {
  groq:      import.meta.env.VITE_GROQ_API_KEY,
  anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY,
  gemini:    import.meta.env.VITE_GEMINI_API_KEY,
  openai:    import.meta.env.VITE_OPENAI_API_KEY,
}

export default function AIQuickFill({ onFill }) {
  const [open, setOpen] = useState(false)
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const entry = Object.entries(ENV_KEYS).find(([, v]) => v)

  const fill = async () => {
    if (!desc.trim() || loading) return
    if (!entry) { setErr('Configura una API key de IA en Vercel para usar esta función.'); return }
    const [provider, apiKey] = entry
    const model = PROVIDERS[provider].models[0].id
    setLoading(true)
    setErr('')
    try {
      const text = await extractTaskFromText(desc, provider, model, apiKey)
      const match = text.match(/\{[\s\S]*?\}/)
      if (!match) throw new Error('Respuesta inesperada de la IA')
      const data = JSON.parse(match[0])
      onFill({
        title: data.title || '',
        description: data.description || '',
        priority: ['urgent', 'high', 'medium', 'low'].includes(data.priority) ? data.priority : 'medium',
        tags: Array.isArray(data.tags) ? data.tags.join(', ') : '',
      })
      setDesc('')
      setOpen(false)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors mb-1"
      >
        <Sparkles size={12} />
        Rellenar con IA
      </button>
    )
  }

  return (
    <div className="bg-violet-600/10 border border-violet-500/20 rounded-xl p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-violet-400" />
          <span className="text-xs font-medium text-violet-300">Rellenar con IA</span>
          {entry && <span className="text-xs text-zinc-600">· {PROVIDERS[entry[0]]?.name}</span>}
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-400 p-0.5 rounded">
          <X size={12} />
        </button>
      </div>
      <div className="flex gap-2">
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fill()}
          placeholder='Ej: "Diseñar logo para el viernes, urgente"'
          className="flex-1 bg-zinc-900 border border-violet-500/30 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-400"
          autoFocus
        />
        <button
          type="button"
          onClick={fill}
          disabled={loading || !desc.trim()}
          className="btn-primary py-1.5 px-3 flex-shrink-0"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        </button>
      </div>
      {err && <p className="text-xs text-red-400 mt-1.5">{err}</p>}
    </div>
  )
}

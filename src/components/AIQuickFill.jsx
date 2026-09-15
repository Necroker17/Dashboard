import { useState, useEffect } from 'react'
import { Sparkles, Loader2, X } from 'lucide-react'
import { extractTaskFromText, fetchConfiguredProviders, fetchModels, extractJson, PROVIDERS } from '../lib/ai'

export default function AIQuickFill({ onFill }) {
  const [open, setOpen] = useState(false)
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [provider, setProvider] = useState(null)
  const [model, setModel] = useState(null)

  // Las keys viven en el servidor; solo preguntamos qué proveedor hay activo y
  // qué modelos tiene. Los identificadores escritos a mano caducan.
  useEffect(() => {
    let cancelled = false
    fetchConfiguredProviders()
      .then(async list => {
        const first = list[0] ?? null
        if (cancelled || !first) return
        setProvider(first)
        const available = await fetchModels(first).catch(() => [])
        if (!cancelled) setModel(available[0]?.id ?? null)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const fill = async () => {
    if (!desc.trim() || loading) return
    if (!provider || !model) {
      setErr('No hay ningún modelo de IA disponible. Revisa la configuración en Vercel.')
      return
    }
    setLoading(true)
    setErr('')
    try {
      const text = await extractTaskFromText(desc, provider, model)
      const data = extractJson(text)
      if (!data) throw new Error('La IA no devolvió un JSON válido. Inténtalo de nuevo.')
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
          {provider && <span className="text-xs text-zinc-600">· {PROVIDERS[provider]?.name}</span>}
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

// Proxy de IA del lado del servidor.
//
// Antes, las keys se leían en el navegador como import.meta.env.VITE_*, y Vite
// las incrusta en texto plano dentro del bundle: cualquier visitante podía
// extraerlas del JavaScript servido. Aquí nunca salen del servidor.
//
// Variables de entorno en Vercel (SIN el prefijo VITE_):
//   GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
// Se mantiene un fallback a los nombres VITE_* para no romper el despliegue
// durante la migración — pero mientras esas existan, siguen expuestas.

const KEY = (name) => process.env[name] || process.env[`VITE_${name}`] || ''

const PROVIDER_KEYS = {
  groq: 'GROQ_API_KEY',
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
}

// Una lista fija de modelos envejece: los proveedores retiran identificadores
// cada pocos meses y la app se rompe sin avisar. El catálogo se consulta al
// propio proveedor, que es la única fuente que nunca queda obsoleta.
//
// Sin lista blanca, lo que valida el modelo es su forma: eso basta para impedir
// inyección en la URL de Gemini, y el alcance real lo pone la clave del dueño —
// solo puede pedir modelos a los que su propia cuenta tiene acceso.
const MODEL_RE = /^[A-Za-z0-9._:-]{1,120}$/

// Lo que no sirve para conversar: audio, imagen, embeddings, moderación.
const NOT_CHAT = /whisper|tts|audio|embed|guard|moderation|image|vision-only|dall-e|imagen|veo|rerank/i

// Qué entra en el plan gratuito. Es una REGLA, no una lista: los nombres de
// modelo cambian cada pocos meses y una lista fija es justo lo que dejó el
// asistente inservible.
//
//   Groq   · el plan gratuito da acceso a todo el catálogo sin tarjeta; lo que
//            limita son las peticiones por minuto, no qué modelo puedes usar.
//   Gemini · gratis es la familia Flash y Flash-Lite. Los Pro están detrás de
//            facturación.
//   OpenAI y Anthropic no tienen plan gratuito de API.
//
// Es orientativo, no una garantía: la protección real es no vincular una cuenta
// de facturación, porque entonces un modelo de pago falla en vez de cobrar.
// Umbral del plan gratuito de Gemini. Google pasó los Flash a cobro a partir de
// la 3.6 (3.6 y 3.8 tienen precio publicado); los anteriores y toda la familia
// Flash-Lite siguen en el plan gratuito.
//
// Es un umbral y no una lista de nombres a propósito: así reconoce versiones que
// todavía no existen sin tener que tocarlo. Pero SÍ hay que revisarlo cuando
// Google mueva la línea otra vez — si un día los 3.8 pasan a gratuitos, sube el
// número. Si la lista se queda vacía, la interfaz avisa y deja ver el resto, así
// que envejecer mal no deja al usuario sin opciones.
const GEMINI_FREE_BELOW = 3.6

function isFreeTier(provider, id) {
  if (provider === 'groq') return true      // catálogo completo sin tarjeta
  if (provider !== 'gemini') return false   // OpenAI y Anthropic no tienen plan gratuito

  if (!/flash/i.test(id) || /\bpro\b/i.test(id)) return false
  if (/flash-?lite/i.test(id)) return true  // Flash-Lite es gratuito en todas las versiones

  const version = parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/i) || [])[1])
  return Number.isFinite(version) && version < GEMINI_FREE_BELOW
}

async function listModels(provider, apiKey) {
  if (provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error?.message || `Gemini ${res.status}`)
    return (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => {
        const id = String(m.name).replace(/^models\//, '')
        return { id, label: m.displayName || null, free: isFreeTier('gemini', id) }
      })
      .filter(m => !NOT_CHAT.test(m.id))
  }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error?.message || `Anthropic ${res.status}`)
    return (data.data || []).map(m => ({ id: m.id, label: m.display_name || null, free: false }))
  }

  // Groq y OpenAI comparten el formato de OpenAI.
  const base = provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1'
  const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${apiKey}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error?.message || `${provider} ${res.status}`)
  return (data.data || [])
    .map(m => ({ id: m.id, label: null, free: isFreeTier(provider, m.id) }))
    .filter(m => !NOT_CHAT.test(m.id))
    .sort((a, b) => a.id.localeCompare(b.id))
}

const DEFAULT_SYSTEM_PROMPT = `You are an expert project manager and productivity assistant integrated into a personal dashboard.
When the user describes a project or goal in natural language, you generate a structured, executable plan with specific tasks.

Always respond with valid JSON in this exact format:
{
  "project_name": "Name of the project",
  "description": "Brief project description",
  "tasks": [
    {
      "title": "Task title",
      "description": "What needs to be done",
      "priority": "urgent|high|medium|low",
      "status": "todo",
      "due_date": "YYYY-MM-DD or null",
      "start_date": "YYYY-MM-DD or null",
      "tags": ["tag1", "tag2"],
      "quadrant": "q1|q2|q3|q4"
    }
  ],
  "summary": "Brief summary of the plan",
  "estimated_duration": "e.g. 2 weeks"
}

Quadrant mapping: q1=urgent+important, q2=important not urgent, q3=urgent not important, q4=neither.
For conversational messages (not plan requests), respond with plain text instead of JSON.`

// Solo usuarios autenticados pueden gastar nuestra cuota.
async function verifyUser(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return null

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    })
    if (!res.ok) return null
    const user = await res.json()
    return user?.id ? user : null
  } catch {
    return null
  }
}

async function callGroq(messages, model, apiKey, sys) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'system', content: sys }, ...messages],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error?.message || `Groq error ${res.status}`)
  return data.choices[0].message.content
}

async function callAnthropic(messages, model, apiKey, sys) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: 4096, system: sys, messages }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error?.message || `Anthropic error ${res.status}`)
  return data.content[0].text
}

async function callGemini(messages, model, apiKey, sys) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: 4096 },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error?.message || `Gemini error ${res.status}`)
  return data.candidates[0].content.parts[0].text
}

async function callOpenAI(messages, model, apiKey, sys) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'system', content: sys }, ...messages],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error?.message || `OpenAI error ${res.status}`)
  return data.choices[0].message.content
}

const CALLERS = {
  groq: callGroq,
  anthropic: callAnthropic,
  gemini: callGemini,
  openai: callOpenAI,
}

export default async function handler(req, res) {
  // Qué proveedores tienen key configurada. No revela la key, solo el nombre.
  if (req.method === 'GET') {
    const configured = Object.entries(PROVIDER_KEYS)
      .filter(([, envName]) => !!KEY(envName))
      .map(([id]) => id)
    return res.status(200).json({ configured })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const user = await verifyUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Inicia sesión para usar el asistente.' })
  }

  const { provider, model, messages, systemPrompt, action } = req.body || {}

  if (!CALLERS[provider]) {
    return res.status(400).json({ error: `Proveedor desconocido: ${provider}` })
  }

  const providerKey = KEY(PROVIDER_KEYS[provider])
  if (!providerKey) {
    return res.status(400).json({
      error: `Falta configurar ${PROVIDER_KEYS[provider]} en las variables de entorno de Vercel.`,
    })
  }

  // Catálogo de modelos disponibles para esta clave, ahora mismo.
  if (action === 'models') {
    try {
      return res.status(200).json({ models: await listModels(provider, providerKey) })
    } catch (err) {
      return res.status(502).json({ error: err.message })
    }
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Faltan los mensajes.' })
  }
  const totalChars = messages.reduce((n, m) => n + (typeof m?.content === 'string' ? m.content.length : 0), 0)
  if (messages.length > 50 || totalChars > 100000) {
    return res.status(413).json({ error: 'La conversación es demasiado larga. Empieza una nueva.' })
  }
  if (typeof model !== 'string' || !MODEL_RE.test(model)) {
    return res.status(400).json({ error: `Identificador de modelo inválido: ${model}` })
  }

  // Normaliza para no reenviar campos extra del cliente al proveedor.
  const clean = messages
    .filter(m => m && typeof m.content === 'string')
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))

  try {
    const text = await CALLERS[provider](
      clean,
      model,
      providerKey,
      typeof systemPrompt === 'string' && systemPrompt ? systemPrompt : DEFAULT_SYSTEM_PROMPT
    )
    return res.status(200).json({ text })
  } catch (err) {
    return res.status(502).json({ error: err.message })
  }
}

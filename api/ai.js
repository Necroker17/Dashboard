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

// Lista blanca: sin esto un usuario autenticado podría pedir cualquier modelo,
// incluido uno mucho más caro que el que la interfaz ofrece.
const ALLOWED_MODELS = {
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  anthropic: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
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

  const { provider, model, messages, systemPrompt } = req.body || {}

  if (!CALLERS[provider]) {
    return res.status(400).json({ error: `Proveedor desconocido: ${provider}` })
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Faltan los mensajes.' })
  }
  const totalChars = messages.reduce((n, m) => n + (typeof m?.content === 'string' ? m.content.length : 0), 0)
  if (messages.length > 50 || totalChars > 100000) {
    return res.status(413).json({ error: 'La conversación es demasiado larga. Empieza una nueva.' })
  }
  if (!ALLOWED_MODELS[provider]?.includes(model)) {
    return res.status(400).json({ error: `Modelo no permitido para ${provider}: ${model}` })
  }

  const apiKey = KEY(PROVIDER_KEYS[provider])
  if (!apiKey) {
    return res.status(400).json({
      error: `Falta configurar ${PROVIDER_KEYS[provider]} en las variables de entorno de Vercel.`,
    })
  }

  // Normaliza para no reenviar campos extra del cliente al proveedor.
  const clean = messages
    .filter(m => m && typeof m.content === 'string')
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))

  try {
    const text = await CALLERS[provider](
      clean,
      model,
      apiKey,
      typeof systemPrompt === 'string' && systemPrompt ? systemPrompt : DEFAULT_SYSTEM_PROMPT
    )
    return res.status(200).json({ text })
  } catch (err) {
    return res.status(502).json({ error: err.message })
  }
}

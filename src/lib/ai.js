import { supabase } from './supabase'

// Metadatos de proveedores. Nada de esto es secreto: las API keys viven ahora
// en el servidor (api/ai.js) y el navegador nunca las ve.
export const PROVIDERS = {
  groq: {
    name: 'Groq',
    badge: 'Gratis',
    color: '#f55036',
    envKey: 'GROQ_API_KEY',
    signupUrl: 'https://console.groq.com',
  },
  anthropic: {
    name: 'Claude',
    badge: 'Premium',
    color: '#cc785c',
    envKey: 'ANTHROPIC_API_KEY',
    signupUrl: 'https://console.anthropic.com',
  },
  gemini: {
    name: 'Gemini',
    badge: 'Gratis',
    color: '#4285f4',
    envKey: 'GEMINI_API_KEY',
    signupUrl: 'https://aistudio.google.com/app/apikey',
  },
  openai: {
    name: 'OpenAI',
    badge: 'Premium',
    color: '#10a37f',
    envKey: 'OPENAI_API_KEY',
    signupUrl: 'https://platform.openai.com/api-keys',
  },
}

// Qué proveedores tienen key en el servidor. El navegador ya no puede saberlo
// por sí mismo, así que lo pregunta.
export async function fetchConfiguredProviders() {
  try {
    const res = await fetch('/api/ai')
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.configured) ? data.configured : []
  } catch {
    return []
  }
}

async function post(body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data.text
}

// Los identificadores de modelo caducan: los proveedores retiran versiones cada
// pocos meses. En vez de mantener una lista en el código —que fue exactamente lo
// que se rompió— se le pregunta al proveedor qué tiene disponible ahora.
export async function fetchModels(providerId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action: 'models', provider: providerId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return Array.isArray(data.models) ? data.models : []
}

export async function sendMessage(messages, providerId, model, systemPrompt) {
  return post({
    provider: providerId,
    model,
    systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  })
}

const TASK_FILL_PROMPT = `Extract task details from the user's description. Return ONLY valid JSON, no other text:
{"title":"concise task title (max 60 chars)","description":"optional details or empty string","priority":"urgent|high|medium|low","tags":["tag1"]}
Priority guide: urgente/ahora/hoy → urgent, importante/pronto → high, normal → medium, luego/después → low.
Tags: 1-3 short relevant tags in the same language as the input.`

export async function extractTaskFromText(text, providerId, model) {
  return post({
    provider: providerId,
    model,
    systemPrompt: TASK_FILL_PROMPT,
    messages: [{ role: 'user', content: text }],
  })
}

// Extrae el primer objeto JSON balanceado. Una expresión regular no codiciosa
// corta en la primera llave de cierre y parte cualquier objeto anidado; una
// codiciosa se traga la prosa posterior que contenga llaves.
export function extractJson(text) {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)) } catch { return null }
    }
  }
  return null
}

export function tryParsePlan(text) {
  const parsed = extractJson(text)
  if (parsed && Array.isArray(parsed.tasks)) return parsed
  return null
}

const QUADRANTS = ['q1', 'q2', 'q3', 'q4']
const PRIORITIES = ['urgent', 'high', 'medium', 'low']
const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done']
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s))

// El modelo puede devolver cualquier cosa — incluido el propio formato del
// prompt ("q1|q2|q3|q4"). Como el import es un solo INSERT, un valor inválido
// cancelaba las doce tareas, no solo la afectada.
export function planToTasks(plan, userId, projectId) {
  return plan.tasks.map((t, i) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    project_id: projectId || null,
    title: String(t.title ?? '').slice(0, 200),
    description: String(t.description ?? ''),
    priority: PRIORITIES.includes(t.priority) ? t.priority : 'medium',
    status: STATUSES.includes(t.status) ? t.status : 'todo',
    due_date: isDate(t.due_date) ? t.due_date : null,
    start_date: isDate(t.start_date) ? t.start_date : null,
    tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
    quadrant: QUADRANTS.includes(t.quadrant) ? t.quadrant : null,
    position: i,
  }))
}

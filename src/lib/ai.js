const SYSTEM_PROMPT = `You are an expert project manager and productivity assistant integrated into a personal dashboard.
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

export const PROVIDERS = {
  groq: {
    name: 'Groq',
    badge: 'Gratis',
    color: '#f55036',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (ultra rápido)' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    ],
    envKey: 'VITE_GROQ_API_KEY',
    signupUrl: 'https://console.groq.com',
  },
  anthropic: {
    name: 'Claude',
    badge: 'Premium',
    color: '#cc785c',
    models: [
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (recomendado)' },
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (rápido)' },
      { id: 'claude-opus-4-8', label: 'Opus 4.8 (máxima calidad)' },
    ],
    envKey: 'VITE_ANTHROPIC_API_KEY',
    signupUrl: 'https://console.anthropic.com',
  },
  gemini: {
    name: 'Gemini',
    badge: 'Gratis',
    color: '#4285f4',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ],
    envKey: 'VITE_GEMINI_API_KEY',
    signupUrl: 'https://aistudio.google.com/app/apikey',
  },
  openai: {
    name: 'OpenAI',
    badge: 'Premium',
    color: '#10a37f',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini (económico)' },
      { id: 'o1-mini', label: 'o1 Mini (razonamiento)' },
    ],
    envKey: 'VITE_OPENAI_API_KEY',
    signupUrl: 'https://platform.openai.com/api-keys',
  },
}

async function callGroq(messages, model, apiKey, sys = SYSTEM_PROMPT) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: sys },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Groq error ${res.status}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

async function callAnthropic(messages, model, apiKey, sys = SYSTEM_PROMPT) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-request-proxy': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: sys,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Anthropic error ${res.status}`)
  }
  const data = await res.json()
  return data.content[0].text
}

async function callGemini(messages, model, apiKey, sys = SYSTEM_PROMPT) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents,
      generationConfig: { maxOutputTokens: 4096 },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini error ${res.status}`)
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

async function callOpenAI(messages, model, apiKey, sys = SYSTEM_PROMPT) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: sys },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `OpenAI error ${res.status}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

export async function sendMessage(messages, providerId, model, apiKey, systemPrompt) {
  if (!apiKey) throw new Error(`API key de ${PROVIDERS[providerId]?.name} no configurada`)
  const sys = systemPrompt || SYSTEM_PROMPT
  switch (providerId) {
    case 'groq':      return callGroq(messages, model, apiKey, sys)
    case 'anthropic': return callAnthropic(messages, model, apiKey, sys)
    case 'gemini':    return callGemini(messages, model, apiKey, sys)
    case 'openai':    return callOpenAI(messages, model, apiKey, sys)
    default:          throw new Error(`Proveedor desconocido: ${providerId}`)
  }
}

const TASK_FILL_PROMPT = `Extract task details from the user's description. Return ONLY valid JSON, no other text:
{"title":"concise task title (max 60 chars)","description":"optional details or empty string","priority":"urgent|high|medium|low","tags":["tag1"]}
Priority guide: urgente/ahora/hoy → urgent, importante/pronto → high, normal → medium, luego/después → low.
Tags: 1-3 short relevant tags in the same language as the input.`

export async function extractTaskFromText(text, providerId, model, apiKey) {
  if (!apiKey) throw new Error('No hay API key configurada')
  return sendMessage([{ role: 'user', content: text }], providerId, model, apiKey, TASK_FILL_PROMPT)
}

export function tryParsePlan(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    if (parsed.tasks && Array.isArray(parsed.tasks)) return parsed
    return null
  } catch {
    return null
  }
}

export function planToTasks(plan, userId, projectId) {
  return plan.tasks.map((t, i) => ({
    id: `task-${Date.now()}-${i}`,
    user_id: userId,
    project_id: projectId || null,
    title: t.title,
    description: t.description || '',
    priority: t.priority || 'medium',
    status: t.status || 'todo',
    due_date: t.due_date || null,
    start_date: t.start_date || null,
    tags: t.tags || [],
    quadrant: t.quadrant || null,
    position: i,
  }))
}

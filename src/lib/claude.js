const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'

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

export async function sendMessage(messages, apiKey) {
  if (!apiKey) throw new Error('Anthropic API key not configured')

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-request-proxy': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error ${res.status}`)
  }

  const data = await res.json()
  return data.content[0].text
}

export function tryParseplan(text) {
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

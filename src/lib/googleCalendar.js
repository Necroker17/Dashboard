import { supabase } from './supabase'

// Permiso de Google para leer y escribir en el calendario. Google lo clasifica
// como «sensible»: con la app sin verificar, solo funciona para las cuentas que
// figuren como usuarios de prueba en la consola de Google Cloud.
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'

async function call(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')

  const res = await fetch('/api/google-calendar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

export const getSyncStatus = () => call('status')
export const runSync = () => call('sync')
export const disconnectGoogle = () => call('disconnect')

// Lanza el consentimiento de Google pidiendo el permiso de calendario.
// access_type=offline + prompt=consent es lo que hace que Google entregue un
// refresh_token; sin ellos solo llega un token de una hora y no se puede
// sincronizar después.
export async function connectGoogleCalendar() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: CALENDAR_SCOPE,
      queryParams: { access_type: 'offline', prompt: 'consent' },
      redirectTo: `${window.location.origin}/calendar?google=connected`,
    },
  })
  if (error) throw error
}

// Supabase guarda provider_refresh_token dentro de la sesión persistida, así que
// esto se dispara en cada carga de página, no solo al volver del consentimiento.
// El servidor ya es idempotente, pero el guardado evita dos POST por arranque.
let lastSent = null

export async function captureProviderToken(session) {
  const refreshToken = session?.provider_refresh_token
  if (!refreshToken || refreshToken === lastSent) return false
  lastSent = refreshToken
  try {
    await call('connect', { refreshToken })
    return true
  } catch (e) {
    lastSent = null   // reintentar en el próximo evento de sesión
    throw e
  }
}

// Tras el consentimiento, la credencial se guarda de forma asíncrona. Esperar un
// tiempo fijo es una carrera: en una conexión lenta la sincronización arrancaba
// antes de que existiera la credencial y fallaba con «no hay cuenta conectada».
export async function waitForConnection({ tries = 10, delayMs = 600 } = {}) {
  for (let i = 0; i < tries; i++) {
    const status = await getSyncStatus().catch(() => null)
    if (status?.connected) return status
    await new Promise(r => setTimeout(r, delayMs))
  }
  return null
}

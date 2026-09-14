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

// Al volver del consentimiento, la sesión trae provider_refresh_token una única
// vez. Hay que capturarlo en ese momento o se pierde.
export async function captureProviderToken(session) {
  const refreshToken = session?.provider_refresh_token
  if (!refreshToken) return false
  await call('connect', { refreshToken })
  return true
}

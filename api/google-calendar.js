// Sincronización en dos vías con Google Calendar.
//
// Variables de entorno necesarias en Vercel (ninguna con prefijo VITE_):
//   GOOGLE_CLIENT_ID           las mismas credenciales OAuth que usa el login
//   GOOGLE_CLIENT_SECRET       de Supabase
//   SUPABASE_SERVICE_ROLE_KEY  para leer el refresh_token, que está fuera del
//                              alcance del rol authenticated a propósito
//
// Acciones (POST { action }):
//   connect     guarda el refresh_token que devuelve el login con Google
//   status      dice si hay cuenta conectada y cuándo se sincronizó
//   sync        baja los cambios de Google y sube los locales
//   disconnect  olvida el refresh_token

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CAL_API = 'https://www.googleapis.com/calendar/v3'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

/* ── Acceso a Supabase por REST, sin SDK ──────────────────────────────── */

async function sb(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.message || `Supabase ${res.status}`)
  return data
}

async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.message || `Supabase rpc ${fn} ${res.status}`)
  return data
}

async function verifyUser(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !SUPABASE_URL || !ANON_KEY) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
    })
    if (!res.ok) return null
    const user = await res.json()
    return user?.id ? user : null
  } catch {
    return null
  }
}

/* ── Google ───────────────────────────────────────────────────────────── */

async function accessTokenFor(refreshToken) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // invalid_grant = el usuario revocó el permiso o el token caducó.
    const detail = data.error === 'invalid_grant'
      ? 'Google revocó el acceso. Vuelve a conectar la cuenta.'
      : data.error_description || data.error || `Google ${res.status}`
    throw new Error(detail)
  }
  return data.access_token
}

async function gcal(accessToken, path, { method = 'GET', body, query } = {}) {
  const qs = query ? '?' + new URLSearchParams(query) : ''
  const res = await fetch(`${CAL_API}${path}${qs}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error?.message || `Google Calendar ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

/* ── Conversión entre los dos formatos ────────────────────────────────── */

// Google usa 'date' para eventos de día completo y 'dateTime' para el resto.
const toGoogle = (ev) => {
  const body = {
    summary: ev.title,
    description: ev.description || undefined,
  }
  if (ev.all_day) {
    const day = String(ev.start_datetime).slice(0, 10)
    const end = ev.end_datetime ? String(ev.end_datetime).slice(0, 10) : day
    // En Google el fin de un evento de día completo es exclusivo.
    const endExclusive = new Date(`${end}T00:00:00Z`)
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)
    body.start = { date: day }
    body.end = { date: endExclusive.toISOString().slice(0, 10) }
  } else {
    body.start = { dateTime: new Date(ev.start_datetime).toISOString() }
    body.end = { dateTime: new Date(ev.end_datetime || ev.start_datetime).toISOString() }
  }
  return body
}

const fromGoogle = (g) => {
  const allDay = !!g.start?.date
  let start, end
  if (allDay) {
    start = `${g.start.date}T00:00:00Z`
    // Google entrega el fin exclusivo; aquí se guarda inclusivo.
    const e = new Date(`${g.end.date}T00:00:00Z`)
    e.setUTCDate(e.getUTCDate() - 1)
    end = `${e.toISOString().slice(0, 10)}T00:00:00Z`
  } else {
    start = g.start.dateTime
    end = g.end?.dateTime || g.start.dateTime
  }
  return {
    title: g.summary || '(sin título)',
    description: g.description || null,
    start_datetime: start,
    end_datetime: end,
    all_day: allDay,
  }
}

/* ── Sincronización ───────────────────────────────────────────────────── */

async function runSync(userId, cred) {
  const accessToken = await accessTokenFor(cred.refresh_token)
  const calId = cred.calendar_id || 'primary'
  const calPath = encodeURIComponent(calId)
  let pulled = 0, pushed = 0, removed = 0, conflicts = 0

  /* 1. Subir lo local antes de bajar, para que un evento recién creado aquí
        vuelva ya emparejado con su id de Google en la misma pasada.

        La lista de pendientes la calcula la base: incluye «editado aquí después
        de la última sincronización», que es una comparación entre dos columnas
        y PostgREST no sabe expresarla en un filtro. */

  const pending = await rpc('sync_pending_events', { p_user_id: userId })

  for (const ev of pending) {
    try {
      if (ev.deleted_at) {
        if (ev.google_event_id) {
          try {
            await gcal(accessToken, `/calendars/${calPath}/events/${ev.google_event_id}`, { method: 'DELETE' })
          } catch (e) {
            // 404/410: ya no está en Google. La baja local es igualmente válida.
            if (e.status !== 404 && e.status !== 410) throw e
          }
        }
        await sb(`calendar_events?id=eq.${ev.id}&user_id=eq.${userId}`, { method: 'DELETE' })
        removed++
        continue
      }

      if (!ev.google_event_id) {
        const created = await gcal(accessToken, `/calendars/${calPath}/events`, {
          method: 'POST', body: toGoogle(ev),
        })
        await rpc('mark_event_synced', {
          p_event_id: ev.id, p_user_id: userId,
          p_google_event_id: created.id, p_google_calendar_id: calId, p_etag: created.etag ?? null,
        })
        pushed++
      } else {
        const updated = await gcal(accessToken, `/calendars/${calPath}/events/${ev.google_event_id}`, {
          method: 'PATCH', body: toGoogle(ev),
        })
        await rpc('mark_event_synced', {
          p_event_id: ev.id, p_user_id: userId,
          p_google_event_id: null, p_google_calendar_id: calId, p_etag: updated.etag ?? null,
        })
        pushed++
      }
    } catch (e) {
      // Un evento problemático no debe abortar la pasada entera.
      console.warn(`Evento ${ev.id} no se pudo subir:`, e.message)
    }
  }

  /* 2. Bajar de Google. Incremental si hay cursor; si Google lo invalida
        (410 Gone) se repite la pasada completa. */

  let syncToken = cred.sync_token
  let pageToken = null
  let nextSyncToken = null
  let guard = 0

  for (;;) {
    if (++guard > 50) break   // tope duro: nunca dar vueltas indefinidas

    const query = pageToken
      ? { pageToken }
      : syncToken
        ? { syncToken }
        : {
            timeMin: new Date(Date.now() - 90 * 864e5).toISOString(),
            maxResults: '250',
            singleEvents: 'true',
          }

    let page
    try {
      page = await gcal(accessToken, `/calendars/${calPath}/events`, { query })
    } catch (e) {
      if (e.status === 410 && syncToken) {
        syncToken = null      // el cursor caducó: se baja todo otra vez
        pageToken = null
        continue
      }
      throw e
    }

    for (const g of page.items || []) {
      if (g.status === 'cancelled') {
        const gone = await sb(
          `calendar_events?user_id=eq.${userId}&google_event_id=eq.${encodeURIComponent(g.id)}`,
          { method: 'DELETE', prefer: 'return=representation' }
        )
        if (gone?.length) removed++
        continue
      }

      const row = fromGoogle(g)
      const outcome = await rpc('upsert_google_event', {
        p_user_id: userId,
        p_google_event_id: g.id,
        p_calendar_id: calId,
        p_title: row.title,
        p_description: row.description,
        p_start: row.start_datetime,
        p_end: row.end_datetime,
        p_all_day: row.all_day,
        p_etag: g.etag ?? null,
      })
      if (outcome === 'skipped_local_newer') conflicts++
      else pulled++
    }

    if (page.nextSyncToken) nextSyncToken = page.nextSyncToken
    pageToken = page.nextPageToken || null
    if (!pageToken) break
  }

  await sb(`google_credentials?user_id=eq.${userId}`, {
    method: 'PATCH',
    body: { sync_token: nextSyncToken, last_sync_at: new Date().toISOString(), last_error: null },
  })

  return { pulled, pushed, removed, conflicts }
}

/* ── Handler ──────────────────────────────────────────────────────────── */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  if (!SERVICE_KEY || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({
      error: 'Falta configurar GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o SUPABASE_SERVICE_ROLE_KEY en Vercel.',
    })
  }

  const user = await verifyUser(req)
  if (!user) return res.status(401).json({ error: 'Inicia sesión primero.' })

  const { action, refreshToken, calendarId } = req.body || {}

  try {
    if (action === 'connect') {
      if (!refreshToken) {
        return res.status(400).json({
          error: 'Google no devolvió un token de renovación. Desconecta la app en tu cuenta de Google y vuelve a conectarla.',
        })
      }
      await sb('google_credentials', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: {
          user_id: user.id,
          refresh_token: refreshToken,
          calendar_id: calendarId || 'primary',
          sync_token: null,      // credencial nueva: la próxima pasada baja todo
          last_error: null,
        },
      })
      return res.status(200).json({ connected: true })
    }

    const rows = await sb(`google_credentials?user_id=eq.${user.id}&select=*`)
    const cred = rows[0]

    if (action === 'status') {
      return res.status(200).json({
        connected: !!cred,
        calendarId: cred?.calendar_id ?? null,
        lastSyncAt: cred?.last_sync_at ?? null,
        lastError: cred?.last_error ?? null,
      })
    }

    if (action === 'disconnect') {
      await sb(`google_credentials?user_id=eq.${user.id}`, { method: 'DELETE' })
      return res.status(200).json({ connected: false })
    }

    if (action === 'sync') {
      if (!cred) return res.status(400).json({ error: 'No hay ninguna cuenta de Google conectada.' })
      try {
        const result = await runSync(user.id, cred)
        return res.status(200).json({ ok: true, ...result })
      } catch (e) {
        await sb(`google_credentials?user_id=eq.${user.id}`, {
          method: 'PATCH', body: { last_error: e.message },
        })
        throw e
      }
    }

    return res.status(400).json({ error: `Acción desconocida: ${action}` })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}

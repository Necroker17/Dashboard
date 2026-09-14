-- Sincronización en dos vías con Google Calendar.
--
-- Supabase entrega el provider_token de Google solo en el momento de iniciar
-- sesión y no lo renueva, así que hay que guardar el refresh_token y canjearlo
-- desde el servidor cada vez que toque sincronizar.

create table if not exists public.google_credentials (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  refresh_token  text not null,
  calendar_id    text not null default 'primary',
  sync_token     text,                    -- cursor incremental de Google
  last_sync_at   timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.google_credentials enable row level security;

-- El usuario puede saber si tiene la cuenta conectada y desconectarla, pero no
-- leer ni escribir el token. Las políticas son de fila, no de columna, así que
-- el secreto se protege además con permisos por columna (abajo).
drop policy if exists "Users can read own google connection" on public.google_credentials;
create policy "Users can read own google connection"
  on public.google_credentials for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can disconnect google" on public.google_credentials;
create policy "Users can disconnect google"
  on public.google_credentials for delete to authenticated
  using (auth.uid() = user_id);

-- refresh_token queda fuera del alcance del navegador: solo lo lee la función
-- serverless, que usa la service role key.
revoke all on public.google_credentials from authenticated, anon;
grant select (user_id, calendar_id, last_sync_at, last_error, created_at, updated_at)
  on public.google_credentials to authenticated;
grant delete on public.google_credentials to authenticated;

drop trigger if exists google_credentials_updated_at on public.google_credentials;
create trigger google_credentials_updated_at
  before update on public.google_credentials
  for each row execute function public.handle_updated_at();

-- ── Mapeo de eventos ───────────────────────────────────────────────────────
alter table public.calendar_events
  add column if not exists google_event_id text,
  add column if not exists google_calendar_id text,
  add column if not exists google_etag text,
  add column if not exists last_synced_at timestamptz,
  -- Borrado lógico: si se borrase la fila de golpe no quedaría constancia de que
  -- hay que propagar la baja a Google. La fila desaparece tras confirmarlo.
  add column if not exists deleted_at timestamptz;

-- Un evento de Google no puede entrar dos veces para el mismo usuario.
create unique index if not exists calendar_events_google_uniq
  on public.calendar_events (user_id, google_event_id)
  where google_event_id is not null;

create index if not exists calendar_events_pending_sync_idx
  on public.calendar_events (user_id, updated_at)
  where deleted_at is not null or google_event_id is null;

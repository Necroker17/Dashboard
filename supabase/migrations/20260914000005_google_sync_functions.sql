-- Funciones de apoyo para la sincronización con Google Calendar.
--
-- Dos problemas que solo se resuelven bien dentro de la base:
--
-- 1) calendar_events tiene un trigger que pone updated_at = now() en cada
--    escritura. Si la sincronización marca last_synced_at con una marca de
--    tiempo calculada en JavaScript, el trigger deja updated_at POSTERIOR y el
--    evento parece «editado después de sincronizar» para siempre: se reenviaría
--    a Google en cada pasada, en bucle. Dentro de una función, now() es el
--    instante de la transacción, así que trigger y columna coinciden al segundo.
--
-- 2) PostgREST no sabe comparar dos columnas entre sí en un filtro, así que
--    «updated_at > last_synced_at» —justo la condición que detecta una edición
--    local pendiente de subir— no se puede expresar por REST.

-- ── Qué hay pendiente de subir a Google ────────────────────────────────────
create or replace function public.sync_pending_events(p_user_id uuid)
returns setof public.calendar_events
language sql
security invoker
set search_path = ''
as $$
  select *
    from public.calendar_events
   where user_id = p_user_id
     and (
       deleted_at is not null          -- borrado local por propagar
       or google_event_id is null      -- creado aquí, aún no está en Google
       or last_synced_at is null       -- nunca sincronizado
       or updated_at > last_synced_at  -- editado aquí después de la última vez
     )
   order by updated_at;
$$;

-- ── Confirmar que un evento local ya está en Google ────────────────────────
create or replace function public.mark_event_synced(
  p_event_id           uuid,
  p_user_id            uuid,
  p_google_event_id    text default null,
  p_google_calendar_id text default null,
  p_etag               text default null
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.calendar_events
     set google_event_id    = coalesce(p_google_event_id, google_event_id),
         google_calendar_id = coalesce(p_google_calendar_id, google_calendar_id),
         google_etag        = coalesce(p_etag, google_etag),
         last_synced_at     = now()   -- mismo now() que verá el trigger
   where id = p_event_id and user_id = p_user_id;
end;
$$;

-- ── Entrada de un evento venido de Google ─────────────────────────────────
-- Devuelve 'inserted', 'updated' o 'skipped_local_newer'. Resuelve el conflicto
-- dentro de la transacción y evita la consulta de existencia por separado.
create or replace function public.upsert_google_event(
  p_user_id         uuid,
  p_google_event_id text,
  p_calendar_id     text,
  p_title           text,
  p_description     text,
  p_start           timestamptz,
  p_end             timestamptz,
  p_all_day         boolean,
  p_etag            text
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing public.calendar_events%rowtype;
begin
  select * into existing
    from public.calendar_events
   where user_id = p_user_id and google_event_id = p_google_event_id;

  if not found then
    insert into public.calendar_events
      (user_id, title, description, start_datetime, end_datetime, all_day,
       google_event_id, google_calendar_id, google_etag, last_synced_at)
    values
      (p_user_id, p_title, p_description, p_start, p_end, p_all_day,
       p_google_event_id, p_calendar_id, p_etag, now());
    return 'inserted';
  end if;

  -- Gana la edición más reciente: si se tocó aquí después de la última
  -- sincronización, lo local manda y ya subió en el paso anterior.
  if existing.last_synced_at is not null and existing.updated_at > existing.last_synced_at then
    return 'skipped_local_newer';
  end if;

  update public.calendar_events
     set title              = p_title,
         description        = p_description,
         start_datetime     = p_start,
         end_datetime       = p_end,
         all_day            = p_all_day,
         google_calendar_id = p_calendar_id,
         google_etag        = p_etag,
         last_synced_at     = now(),
         deleted_at         = null
   where id = existing.id;

  return 'updated';
end;
$$;

-- Solo las llama la función serverless con la service role key.
revoke execute on function public.sync_pending_events(uuid) from anon, authenticated, public;
revoke execute on function public.mark_event_synced(uuid, uuid, text, text, text) from anon, authenticated, public;
revoke execute on function public.upsert_google_event(uuid, text, text, text, text, timestamptz, timestamptz, boolean, text) from anon, authenticated, public;

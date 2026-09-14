-- Correcciones a la sincronización, tras revisar el motor a fondo.
--
-- 1) upsert_google_event hacía SELECT y luego INSERT: dos pestañas
--    sincronizando a la vez encontraban ambas «no existe», ambas insertaban, y
--    la segunda reventaba contra el índice único, abortando la pasada entera.
--    Se resuelve dentro de la sentencia con ON CONFLICT.
--
-- 2) Se añade una versión por lotes. Una llamada por evento agota los 10 s de
--    Vercel alrededor de los 250 eventos, y como el cursor se guardaba al final,
--    el siguiente intento empezaba de cero y volvía a agotarse: bloqueo
--    permanente. Con el lote, es una llamada por página.
--
-- 3) mark_event_synced fija updated_at explícitamente en lugar de confiar en
--    que el trigger use now() y no clock_timestamp(). Si usara el segundo, la
--    fila quedaría «más nueva» por microsegundos y volvería el bucle de reenvío.

create or replace function public.mark_event_synced(
  p_event_id           uuid,
  p_user_id            uuid,
  p_google_event_id    text default null,
  p_google_calendar_id text default null,
  p_etag               text default null
) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  update public.calendar_events
     set google_event_id    = coalesce(p_google_event_id, google_event_id),
         google_calendar_id = coalesce(p_google_calendar_id, google_calendar_id),
         google_etag        = coalesce(p_etag, google_etag),
         last_synced_at     = now(),
         updated_at         = now()   -- explícito: no depende del trigger
   where id = p_event_id and user_id = p_user_id;
end;
$$;

-- Un evento que Google ya no reconoce: se olvida el emparejamiento para que la
-- próxima pasada lo vuelva a crear en lugar de reintentar un PATCH imposible.
create or replace function public.unlink_google_event(
  p_event_id uuid,
  p_user_id  uuid
) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  update public.calendar_events
     set google_event_id = null,
         google_etag     = null,
         last_synced_at  = null
   where id = p_event_id and user_id = p_user_id;
end;
$$;

-- Una página entera de Google en una sola llamada.
-- Devuelve {inserted, updated, skipped} para poder informar al usuario.
create or replace function public.upsert_google_events(
  p_user_id     uuid,
  p_calendar_id text,
  p_events      jsonb            -- [{google_event_id,title,description,start,end,all_day,etag}]
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  ins int := 0; upd int := 0; skip int := 0;
  e jsonb;
  existing public.calendar_events%rowtype;
begin
  for e in select * from jsonb_array_elements(p_events) loop
    select * into existing
      from public.calendar_events
     where user_id = p_user_id
       and google_event_id = e->>'google_event_id';

    -- Gana la edición más reciente: si se tocó aquí después de la última
    -- sincronización, lo local manda y ya subió en el paso anterior.
    if found and existing.last_synced_at is not null
       and existing.updated_at > existing.last_synced_at then
      skip := skip + 1;
      continue;
    end if;

    insert into public.calendar_events
      (user_id, title, description, start_datetime, end_datetime, all_day,
       google_event_id, google_calendar_id, google_etag, last_synced_at, updated_at)
    values
      (p_user_id,
       coalesce(e->>'title', '(sin título)'),
       e->>'description',
       (e->>'start')::timestamptz,
       (e->>'end')::timestamptz,
       coalesce((e->>'all_day')::boolean, false),
       e->>'google_event_id',
       p_calendar_id,
       e->>'etag',
       now(), now())
    on conflict (user_id, google_event_id) where google_event_id is not null
    do update set
      title              = excluded.title,
      description        = excluded.description,
      start_datetime     = excluded.start_datetime,
      end_datetime       = excluded.end_datetime,
      all_day            = excluded.all_day,
      google_calendar_id = excluded.google_calendar_id,
      google_etag        = excluded.google_etag,
      last_synced_at     = now(),
      updated_at         = now(),
      deleted_at         = null;

    if found then upd := upd + 1; else ins := ins + 1; end if;
  end loop;

  return jsonb_build_object('inserted', ins, 'updated', upd, 'skipped', skip);
end;
$$;

-- Al desconectar la cuenta, las bajas lógicas pendientes ya no se podrán
-- propagar nunca: se eliminan para no dejar filas fantasma invisibles.
create or replace function public.purge_pending_deletions(p_user_id uuid)
returns int
language plpgsql security invoker set search_path = ''
as $$
declare n int;
begin
  delete from public.calendar_events
   where user_id = p_user_id and deleted_at is not null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Solo las llama la función serverless. El grant explícito evita depender de los
-- privilegios por defecto de Supabase: si cambiasen, toda sincronización fallaría
-- con un críptico «function not found».
revoke execute on function public.mark_event_synced(uuid, uuid, text, text, text) from anon, authenticated, public;
revoke execute on function public.unlink_google_event(uuid, uuid) from anon, authenticated, public;
revoke execute on function public.upsert_google_events(uuid, text, jsonb) from anon, authenticated, public;
revoke execute on function public.purge_pending_deletions(uuid) from anon, authenticated, public;
revoke execute on function public.sync_pending_events(uuid) from anon, authenticated, public;

grant execute on function public.mark_event_synced(uuid, uuid, text, text, text) to service_role;
grant execute on function public.unlink_google_event(uuid, uuid) to service_role;
grant execute on function public.upsert_google_events(uuid, text, jsonb) to service_role;
grant execute on function public.purge_pending_deletions(uuid) to service_role;
grant execute on function public.sync_pending_events(uuid) to service_role;

-- Sustituida por la versión por lotes.
drop function if exists public.upsert_google_event(uuid, text, text, text, text, timestamptz, timestamptz, boolean, text);

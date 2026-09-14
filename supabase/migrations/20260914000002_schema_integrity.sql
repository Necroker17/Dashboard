-- Integridad de esquema. Cada paso limpia antes de imponer la restricción: de lo
-- contrario la migración aborta con exactamente los datos que viene a corregir.
-- Escrita para poder aplicarse más de una vez (supabase db reset, ramas, etc).

-- ── tasks.project_id: le faltaba la clave foránea ───────────────────────────
-- Borrar un proyecto dejaba sus tareas vivas con un project_id colgante,
-- invisibles en la vista Lista. goals y calendar_events ya la tenían.

-- Primero se sueltan las referencias muertas, o el ADD CONSTRAINT falla.
update public.tasks t
   set project_id = null
 where project_id is not null
   and not exists (select 1 from public.projects p where p.id = t.project_id);

alter table public.tasks drop constraint if exists tasks_project_id_fkey;
alter table public.tasks
  add constraint tasks_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete set null;

-- ── habit_history: un doble clic creaba dos filas para el mismo día ─────────
-- Se conserva la más reciente de cada par antes de crear el índice único.
delete from public.habit_history h
 where exists (
   select 1 from public.habit_history other
    where other.habit_id = h.habit_id
      and other.date_str = h.date_str
      and (other.created_at, other.id) > (h.created_at, h.id)
 );

create unique index if not exists habit_history_habit_date_uniq
  on public.habit_history (habit_id, date_str);

-- ── tasks.due_date: era text mientras start_date es date ───────────────────
-- Sin validación, la columna aceptaba "mañana" o "2026-13-45". El CASE descarta
-- lo que no sea una fecha ISO en vez de abortar la migración entera.
do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'tasks'
         and column_name = 'due_date') = 'text' then
    alter table public.tasks
      alter column due_date type date
      using case when due_date ~ '^\d{4}-\d{2}-\d{2}$' then due_date::date end;
  end if;
end $$;

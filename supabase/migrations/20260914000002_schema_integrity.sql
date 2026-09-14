-- Borrar un proyecto dejaba sus tareas con un project_id colgante, invisibles en
-- la vista Lista. goals y calendar_events ya tenían esta clave foránea.
alter table public.tasks
  add constraint tasks_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete set null;

-- Sin índice único, un doble clic en un hábito creaba dos filas para el mismo día.
create unique index if not exists habit_history_habit_date_uniq
  on public.habit_history (habit_id, date_str);

-- due_date era text mientras start_date es date: sin validación, la base aceptaba
-- "mañana" o "2026-13-45". Seguro ahora que clean() normaliza '' a null.
alter table public.tasks
  alter column due_date type date using nullif(due_date, '')::date;

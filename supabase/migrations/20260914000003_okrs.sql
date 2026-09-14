-- OKRs: un Objetivo cualitativo con 2-5 Resultados Clave medibles colgando.
--
-- La tabla goals ya tenía target_value / current_value / unit, así que una meta
-- actual ES un Resultado Clave. Solo falta el nivel de arriba: se añade la tabla
-- objectives y una referencia desde goals. Las metas sin objective_id siguen
-- funcionando como metas sueltas.

create table if not exists public.objectives (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  text references public.projects(id) on delete set null,
  title       text not null,
  description text,
  period      text,                                   -- "2026-Q3", "Semestre 1"...
  start_date  date,
  deadline    date,
  color       text default '#7c3aed',
  status      text not null default 'active'
              check (status in ('active', 'completed', 'abandoned')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.goals
  add column if not exists objective_id uuid references public.objectives(id) on delete set null;

-- Un Resultado Clave puede ir hacia arriba (cerrar 30 pedidos) o hacia abajo
-- (bajar el CPA de $12 a $8). Sin start_value no hay forma de medir el progreso
-- de los segundos: sin él, "bajar a 8" estando en 9.20 parecería un 115%.
alter table public.goals
  add column if not exists direction text not null default 'increase'
  check (direction in ('increase', 'decrease'));

alter table public.goals
  add column if not exists start_value numeric not null default 0;

create index if not exists goals_objective_id_idx on public.goals (objective_id);
create index if not exists objectives_user_id_idx on public.objectives (user_id);

-- Mismo patrón que el resto de tablas: cada quien ve y toca lo suyo.
alter table public.objectives enable row level security;

drop policy if exists "Users can manage own objectives" on public.objectives;
create policy "Users can manage own objectives"
  on public.objectives for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists objectives_updated_at on public.objectives;
create trigger objectives_updated_at
  before update on public.objectives
  for each row execute function public.handle_updated_at();

-- Las políticas de ai_sessions / ai_plans exigían profiles.plan = 'premium'.
-- profiles.plan vale 'free' por defecto, así que TODO usuario real era rechazado
-- al guardar (0 filas en ai_sessions pese a uso real del asistente).
-- Además el filtro no protegía nada: authenticated tiene UPDATE sobre
-- profiles.plan, así que cualquiera podía auto-ascenderse a premium.
-- Se alinean con el resto de tablas: acceso a lo propio y nada más.

drop policy if exists "Premium users can manage ai sessions" on public.ai_sessions;
create policy "Users can manage own ai sessions"
  on public.ai_sessions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Premium users can manage ai plans" on public.ai_plans;
create policy "Users can manage own ai plans"
  on public.ai_plans for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

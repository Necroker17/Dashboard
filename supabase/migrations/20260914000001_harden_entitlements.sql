-- Hallazgo 05: el usuario no debe poder escribir su propio derecho de acceso.
-- El REVOKE por columna no basta si el rol tiene UPDATE a nivel de TABLA (lo
-- implica para todas las columnas): hay que quitar el permiso de tabla y
-- reconcederlo solo sobre las columnas editables. 'plan' queda fuera.
revoke update, insert on public.profiles from authenticated, anon;

grant update (name, tagline, avatar_url, theme, full_name, updated_at)
  on public.profiles to authenticated;

grant insert (id, name, tagline, avatar_url, theme, full_name, email, updated_at)
  on public.profiles to authenticated;

revoke all on public.profiles from anon;
grant select on public.profiles to anon;

-- subscriptions tenía FOR ALL: cualquiera podía emitirse una suscripción activa.
drop policy if exists "Users can manage own subscriptions" on public.subscriptions;
create policy "Users can read own subscription"
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

-- Funciones SECURITY DEFINER con search_path mutable.
alter function public.handle_updated_at() set search_path = '';

create or replace function public.delete_user_account()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_user_account() from anon, public;
grant execute on function public.delete_user_account() to authenticated;

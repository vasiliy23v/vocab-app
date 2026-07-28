-- Security fix: profiles_update_own only restricts which ROW a user can
-- touch (id = auth.uid()), not which COLUMNS — role was updatable by
-- anyone editing their own row via a direct client call (e.g.
-- supabase.from('profiles').update({ role: 'superadmin' })), completely
-- bypassing the admin_set_role RPC's superadmin check. Block role changes
-- at the row level unless the acting user is already a superadmin.

create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'
    ) then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role_trigger on public.profiles;
create trigger profiles_guard_role_trigger
  before update on public.profiles
  for each row
  execute function public.profiles_guard_role();

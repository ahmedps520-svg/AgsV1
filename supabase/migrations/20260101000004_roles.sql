-- ===========================================================================
-- AGS Dismissal — simplify the role model
-- ---------------------------------------------------------------------------
-- Two roles turned out not to exist at AGS:
--
--   • `display` — there is no separate read-only classroom screen. A teacher
--     signs in and can see and do everything on their class boards.
--   • a distinct "driver" — a driver is simply a parent-role account linked to
--     a student. Which relationship they have (Mother, Father, Driver) is the
--     `guardians.relationship` field, not a role.
--
-- Roles are now: admin, staff, parent.
-- ===========================================================================

-- 1. Nobody is a display account any more.
update public.profiles set role = 'staff' where role = 'display';

-- 2. Redefine the helper before the value disappears from the enum, so the
--    function body no longer names it. Board access is simply staff access.
create or replace function public.is_board_viewer()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role in ('admin', 'staff')
  );
$$;

comment on function public.is_board_viewer() is
  'Kept as the name the RLS policies use; now identical to is_staff().';

-- 3. Swap the enum. `current_role_name()` returns the old type, and a return
--    type cannot be changed in place, so it is dropped and rebuilt.
drop function if exists public.current_role_name();

alter type public.user_role rename to user_role_legacy;
create type public.user_role as enum ('admin', 'staff', 'parent');

alter table public.profiles
  alter column role drop default,
  alter column role type public.user_role using role::text::public.user_role,
  alter column role set default 'parent';

-- Rebuilt against the new type.
create function public.current_role_name()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, school_id, role, full_name, email, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'school_id', '')::uuid,
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'parent')::public.user_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case
          when public.profiles.full_name = '' then excluded.full_name
          else public.profiles.full_name
        end;
  return new;
end;
$$;

drop type public.user_role_legacy;

-- 4. The students policy is about staff, not screens.
drop policy if exists "school staff and screens read students" on public.students;
create policy "staff read students in their school"
  on public.students for select to authenticated
  using (school_id = public.current_school_id() and public.is_staff());

grant execute on function public.current_role_name() to authenticated;
grant execute on function public.is_board_viewer() to authenticated;

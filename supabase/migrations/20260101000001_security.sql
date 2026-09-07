-- ===========================================================================
-- Map Dismissals — authorization helpers + Row Level Security
-- ---------------------------------------------------------------------------
-- Every policy is expressed in terms of the four helpers below. They are
-- SECURITY DEFINER so that reading the caller's own profile does not re-enter
-- the policies on `profiles` (which would recurse).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Timestamps
-- ---------------------------------------------------------------------------

create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_schools before update on public.schools
  for each row execute function public.tg_touch_updated_at();
create trigger touch_profiles before update on public.profiles
  for each row execute function public.tg_touch_updated_at();
create trigger touch_classrooms before update on public.classrooms
  for each row execute function public.tg_touch_updated_at();
create trigger touch_students before update on public.students
  for each row execute function public.tg_touch_updated_at();
create trigger touch_dismissal_requests before update on public.dismissal_requests
  for each row execute function public.tg_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Auth helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select school_id from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.current_role_name()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_staff()
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

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role = 'admin'
  );
$$;

-- Board displays get read-only access to the queue, nothing else.
create or replace function public.is_board_viewer()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role in ('admin', 'staff', 'display')
  );
$$;

-- True when the caller is an authorised guardian of the student.
create or replace function public.is_guardian_of(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.guardians g
    join public.profiles p on p.id = g.profile_id
    where g.student_id = p_student_id
      and g.profile_id = auth.uid()
      and g.can_pickup
      and p.is_active
  );
$$;

-- True when the caller is linked to the student at all (even if pickup is
-- currently blocked) — this is what "may see this student" means.
create or replace function public.is_linked_guardian(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.guardians
    where student_id = p_student_id and profile_id = auth.uid()
  );
$$;

-- The helpers below exist so that a policy on one table never has to SELECT
-- another RLS-protected table. Without them `students` -> `guardians` ->
-- `students` recurses and Postgres aborts the query.
create or replace function public.student_school_id(p_student_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select school_id from public.students where id = p_student_id;
$$;

create or replace function public.request_student_id(p_request_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select student_id from public.dismissal_requests where id = p_request_id;
$$;

create or replace function public.is_guardian_classroom(p_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.students s
    join public.guardians g on g.student_id = s.id
    where s.classroom_id = p_classroom_id and g.profile_id = auth.uid()
  );
$$;

grant execute on function public.current_school_id() to authenticated;
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_board_viewer() to authenticated;
grant execute on function public.is_guardian_of(uuid) to authenticated;
grant execute on function public.is_linked_guardian(uuid) to authenticated;
grant execute on function public.student_school_id(uuid) to authenticated;
grant execute on function public.request_student_id(uuid) to authenticated;
grant execute on function public.is_guardian_classroom(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- New auth user -> profile
-- ---------------------------------------------------------------------------

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Snapshot student + guardian details onto a request
-- ---------------------------------------------------------------------------

create or replace function public.tg_snapshot_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student record;
  v_tz      text;
begin
  select s.school_id,
         trim(s.first_name || ' ' || s.last_name) as full_name,
         s.grade,
         s.pickup_number,
         c.name as classroom_name
    into v_student
    from public.students s
    left join public.classrooms c on c.id = s.classroom_id
   where s.id = new.student_id;

  if v_student is null then
    raise exception 'Student % does not exist', new.student_id
      using errcode = 'foreign_key_violation';
  end if;

  new.school_id      := v_student.school_id;
  new.student_name   := v_student.full_name;
  new.student_grade  := v_student.grade;
  new.classroom_name := v_student.classroom_name;
  new.pickup_number  := coalesce(nullif(new.pickup_number, ''), v_student.pickup_number);

  select timezone into v_tz from public.schools where id = new.school_id;
  new.dismissal_date := (now() at time zone coalesce(v_tz, 'UTC'))::date;

  if new.requested_by is not null then
    select full_name into new.guardian_name from public.profiles where id = new.requested_by;
  end if;

  return new;
end;
$$;

create trigger snapshot_dismissal_request
  before insert on public.dismissal_requests
  for each row execute function public.tg_snapshot_request();

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------

create or replace function public.tg_log_dismissal_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_name text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select full_name into v_actor_name from public.profiles where id = auth.uid();

  insert into public.dismissal_events (request_id, school_id, actor_id, actor_name, from_status, to_status)
  values (
    new.id,
    new.school_id,
    auth.uid(),
    v_actor_name,
    case when tg_op = 'UPDATE' then old.status end,
    new.status
  );

  return new;
end;
$$;

create trigger log_dismissal_request_event
  after insert or update on public.dismissal_requests
  for each row execute function public.tg_log_dismissal_event();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.schools            enable row level security;
alter table public.profiles           enable row level security;
alter table public.classrooms         enable row level security;
alter table public.students           enable row level security;
alter table public.guardians          enable row level security;
alter table public.dismissal_requests enable row level security;
alter table public.dismissal_events   enable row level security;

-- --- schools ---------------------------------------------------------------

create policy "school members read their school"
  on public.schools for select to authenticated
  using (id = public.current_school_id());

create policy "admins update their school"
  on public.schools for update to authenticated
  using (id = public.current_school_id() and public.is_admin())
  with check (id = public.current_school_id() and public.is_admin());

-- --- profiles --------------------------------------------------------------

create policy "read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "staff read profiles in their school"
  on public.profiles for select to authenticated
  using (school_id = public.current_school_id() and public.is_staff());

create policy "update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "admins manage profiles in their school"
  on public.profiles for update to authenticated
  using (school_id = public.current_school_id() and public.is_admin())
  with check (school_id = public.current_school_id() and public.is_admin());

create policy "admins delete profiles in their school"
  on public.profiles for delete to authenticated
  using (school_id = public.current_school_id() and public.is_admin() and id <> auth.uid());

-- --- classrooms ------------------------------------------------------------

create policy "staff read classrooms"
  on public.classrooms for select to authenticated
  using (school_id = public.current_school_id() and public.is_board_viewer());

create policy "guardians read classrooms of their students"
  on public.classrooms for select to authenticated
  using (public.is_guardian_classroom(classrooms.id));

create policy "admins manage classrooms"
  on public.classrooms for all to authenticated
  using (school_id = public.current_school_id() and public.is_admin())
  with check (school_id = public.current_school_id() and public.is_admin());

-- --- students --------------------------------------------------------------
-- Parents can only ever read students they are an authorised guardian for.

create policy "staff read students in their school"
  on public.students for select to authenticated
  using (school_id = public.current_school_id() and public.is_staff());

create policy "guardians read their own students"
  on public.students for select to authenticated
  using (public.is_linked_guardian(students.id));

create policy "admins manage students"
  on public.students for all to authenticated
  using (school_id = public.current_school_id() and public.is_admin())
  with check (school_id = public.current_school_id() and public.is_admin());

-- --- guardians -------------------------------------------------------------

create policy "read own guardian links"
  on public.guardians for select to authenticated
  using (profile_id = auth.uid());

create policy "staff read guardian links in their school"
  on public.guardians for select to authenticated
  using (
    public.is_staff()
    and public.student_school_id(guardians.student_id) = public.current_school_id()
  );

create policy "admins manage guardian links"
  on public.guardians for all to authenticated
  using (
    public.is_admin()
    and public.student_school_id(guardians.student_id) = public.current_school_id()
  )
  with check (
    public.is_admin()
    and public.student_school_id(guardians.student_id) = public.current_school_id()
  );

-- --- dismissal_requests ----------------------------------------------------
-- Reads are open to the right people so that Realtime can stream changes
-- straight to the browser. Writes go exclusively through the SECURITY DEFINER
-- functions in the next migration, which enforce the state machine.

create policy "staff and boards read the queue"
  on public.dismissal_requests for select to authenticated
  using (school_id = public.current_school_id() and public.is_board_viewer());

create policy "guardians read requests for their students"
  on public.dismissal_requests for select to authenticated
  using (public.is_linked_guardian(dismissal_requests.student_id));

-- --- dismissal_events ------------------------------------------------------

create policy "staff read the audit trail"
  on public.dismissal_events for select to authenticated
  using (school_id = public.current_school_id() and public.is_staff());

create policy "guardians read events for their students"
  on public.dismissal_events for select to authenticated
  using (public.is_linked_guardian(public.request_student_id(dismissal_events.request_id)));

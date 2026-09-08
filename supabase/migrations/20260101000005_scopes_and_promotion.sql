-- ===========================================================================
-- AGS Dismissal — shared section accounts, student gender, year promotion
-- ---------------------------------------------------------------------------
-- AGS signs in with ONE shared account per section rather than per teacher:
--
--   dismissal.boys@ags.edu.sa   → every boys' class
--   dismissal.girls@ags.edu.sa  → every girls' class
--   dismissal.kg@ags.edu.sa     → the mixed kindergarten classes
--
-- `profiles.section_scope` is what makes that safe: the boys account cannot
-- read a girls' class, its roster, or its calls — enforced by RLS, not by the
-- screen. Administrators get scope 'all'.
-- ===========================================================================

create type public.section_scope as enum ('boys', 'girls', 'mixed', 'all');

alter table public.profiles
  add column section_scope public.section_scope not null default 'all';

comment on column public.profiles.section_scope is
  'Which classes this account may open. ''all'' is unrestricted (administrators).';

-- Kindergarten is mixed, so a KG student''s own gender is the only thing that
-- can decide which Grade 1 class they move into at promotion.
alter table public.students
  add column gender public.class_gender;

comment on column public.students.gender is
  'boys/girls. Required to promote a mixed KG class into split Grade 1 classes.';

-- Backfill from the class the student is already in.
update public.students s
   set gender = c.gender
  from public.classrooms c
 where s.classroom_id = c.id and c.gender <> 'mixed';

-- Snapshot the section onto each call so the board filter and the RLS check
-- are a single-column test rather than a join.
alter table public.dismissal_requests
  add column class_gender public.class_gender;

create index dismissal_requests_section_idx
  on public.dismissal_requests (school_id, dismissal_date, class_gender);

-- ---------------------------------------------------------------------------
-- Scope helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_scope()
returns public.section_scope
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select section_scope from public.profiles where id = auth.uid() and is_active;
$$;

/** True when the caller's account may open a class of this section. */
create or replace function public.scope_allows(p_gender public.class_gender)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.current_scope() = 'all' then true
    when p_gender is null then false
    else public.current_scope()::text = p_gender::text
  end;
$$;

create or replace function public.student_gender(p_student_id uuid)
returns public.class_gender
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(s.gender, c.gender)
    from public.students s
    left join public.classrooms c on c.id = s.classroom_id
   where s.id = p_student_id;
$$;

grant execute on function public.current_scope() to authenticated;
grant execute on function public.scope_allows(public.class_gender) to authenticated;
grant execute on function public.student_gender(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Snapshot the section when a call is created
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
         c.name as classroom_name,
         coalesce(c.gender, s.gender) as class_gender
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
  new.class_gender   := v_student.class_gender;
  new.pickup_number  := coalesce(nullif(new.pickup_number, ''), v_student.pickup_number);

  select timezone into v_tz from public.schools where id = new.school_id;
  new.dismissal_date := (now() at time zone coalesce(v_tz, 'UTC'))::date;

  if new.requested_by is not null then
    select full_name into new.guardian_name from public.profiles where id = new.requested_by;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Re-scope the staff read policies
-- ---------------------------------------------------------------------------

drop policy if exists "staff read students in their school" on public.students;
create policy "staff read students in their section"
  on public.students for select to authenticated
  using (
    school_id = public.current_school_id()
    and public.is_staff()
    and public.scope_allows(public.student_gender(students.id))
  );

drop policy if exists "staff read classrooms" on public.classrooms;
create policy "staff read classrooms in their section"
  on public.classrooms for select to authenticated
  using (
    school_id = public.current_school_id()
    and public.is_board_viewer()
    and public.scope_allows(classrooms.gender)
  );

drop policy if exists "staff and boards read the queue" on public.dismissal_requests;
create policy "staff read calls in their section"
  on public.dismissal_requests for select to authenticated
  using (
    school_id = public.current_school_id()
    and public.is_board_viewer()
    and public.scope_allows(dismissal_requests.class_gender)
  );

-- Staff may only act on a class inside their own section.
create or replace function public.require_staff_for_student(p_student_id uuid)
returns public.profiles
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles := public.require_staff();
  v_school  uuid;
begin
  select school_id into v_school from public.students where id = p_student_id;

  if v_school is null or v_school <> v_profile.school_id then
    raise exception 'That student is not enrolled at your school.' using errcode = '42501';
  end if;

  if not public.scope_allows(public.student_gender(p_student_id)) then
    raise exception 'That class is not in your section.' using errcode = '42501';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.require_staff_for_student(uuid) from public;

-- ---------------------------------------------------------------------------
-- Section-aware call + dismiss
-- ---------------------------------------------------------------------------

create or replace function public.staff_call_student(p_student_id uuid)
returns public.dismissal_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile  public.profiles := public.require_staff_for_student(p_student_id);
  v_existing public.dismissal_requests;
  v_new      public.dismissal_requests;
begin
  select * into v_existing
    from public.dismissal_requests
   where student_id = p_student_id
     and status in ('requested', 'waiting', 'called', 'ready')
   limit 1;

  if v_existing.id is not null then
    return public.set_request_status(v_existing.id, 'called');
  end if;

  insert into public.dismissal_requests (student_id, status, source, requested_by, called_by, called_at)
  values (p_student_id, 'called', 'staff', v_profile.id, v_profile.id, now())
  returning * into v_new;

  return v_new;
end;
$$;

create or replace function public.set_request_status(
  p_request_id uuid,
  p_status public.dismissal_status
)
returns public.dismissal_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.dismissal_requests;
  v_profile public.profiles;
  v_now     timestamptz := now();
begin
  select * into v_request from public.dismissal_requests where id = p_request_id;

  if v_request.id is null then
    raise exception 'That dismissal request could not be found.' using errcode = 'P0002';
  end if;

  -- Also proves the caller's section covers this student's class.
  v_profile := public.require_staff_for_student(v_request.student_id);

  if p_status = 'cancelled' then
    raise exception 'Use cancel_request() to cancel a dismissal.' using errcode = '22023';
  end if;

  if p_status = 'requested' then
    raise exception 'Only a parent or driver can create an arrival request.'
      using errcode = '22023';
  end if;

  update public.dismissal_requests
     set status       = p_status,
         called_at    = case when p_status = 'waiting' then null else coalesce(called_at, v_now) end,
         called_by    = case
                          when p_status = 'waiting' then null
                          when source = 'staff' then coalesce(called_by, v_profile.id)
                          else called_by
                        end,
         ready_at     = case
                          when p_status in ('waiting', 'called') then null
                          when p_status = 'ready' then v_now
                          else coalesce(ready_at, v_now)
                        end,
         picked_up_at = case when p_status = 'picked_up' then v_now else null end,
         released_by  = case when p_status = 'picked_up' then v_profile.id else null end,
         cancelled_at = null,
         cancel_reason = null
   where id = p_request_id
   returning * into v_request;

  return v_request;
exception
  when unique_violation then
    raise exception 'That student already has another active dismissal in the queue.'
      using errcode = '23505';
end;
$$;

-- ---------------------------------------------------------------------------
-- End-of-year promotion
-- ---------------------------------------------------------------------------

/** KG1 → KG2 → KG3 → 1 → 2 … → 12. Grade 12 has nowhere to go. */
create or replace function public.next_level(p_level text)
returns text
language sql
immutable
as $$
  select case
    when p_level = 'KG1' then 'KG2'
    when p_level = 'KG2' then 'KG3'
    when p_level = 'KG3' then '1'
    when p_level ~ '^[0-9]+$' and p_level::int < 12 then (p_level::int + 1)::text
    else null
  end;
$$;

/** Sections are lettered in kindergarten and numbered in the grades. */
drop function if exists public.next_section(text, boolean);
create function public.next_section(p_section text, p_to_kg boolean)
returns text
language sql
immutable
as $$
  -- Sections are lettered in kindergarten and numbered in the grades, so what
  -- decides the notation is where the student is GOING, not where they came
  -- from. KG1-A becomes KG2-A; KG3-B becomes Grade 1 section 2.
  select case
    when p_to_kg then
      case
        when upper(p_section) between 'A' and 'F' then upper(p_section)
        when p_section ~ '^[1-6]$' then chr(ascii('A') + p_section::int - 1)
        else 'A'
      end
    else
      case
        when p_section ~ '^[1-9][0-9]*$' then p_section
        when upper(p_section) between 'A' and 'F'
          then (ascii(upper(p_section)) - ascii('A') + 1)::text
        else '1'
      end
  end;
$$;

/**
 * Moves every student up one grade, at the end of the school year.
 *
 * Grade 12 leaves the school: those students are deleted along with their
 * dismissal history, which is what AGS asked for. Everything else moves into
 * the same section one level up, and the target class is created if it does
 * not exist yet.
 *
 * A kindergarten student with no recorded gender cannot be placed into a split
 * Grade 1 class; those are left where they are and reported back so the office
 * can fix them.
 */
create or replace function public.promote_all_students()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile   public.profiles := public.require_profile();
  v_graduated integer := 0;
  v_promoted  integer := 0;
  v_skipped   integer := 0;
  v_row       record;
  v_level     text;
  v_gender    public.class_gender;
  v_section   text;
  v_target    uuid;
begin
  if v_profile.role <> 'admin' then
    raise exception 'Only a school administrator can promote the whole school.'
      using errcode = '42501';
  end if;

  -- 1. Grade 12 leaves.
  delete from public.students s
   using public.classrooms c
   where s.classroom_id = c.id
     and s.school_id = v_profile.school_id
     and c.level = '12';
  get diagnostics v_graduated = row_count;

  -- 2. Everyone else moves up. Highest grades first so a class never receives
  --    students before its own occupants have left it.
  for v_row in
    select s.id as student_id, s.gender as student_gender,
           c.level, c.gender as class_gender, c.section
      from public.students s
      join public.classrooms c on c.id = s.classroom_id
     where s.school_id = v_profile.school_id
     order by case when c.level ~ '^[0-9]+$' then c.level::int else -1 end desc
  loop
    v_level := public.next_level(v_row.level);
    if v_level is null then
      continue;
    end if;

    -- Leaving kindergarten means the student's own gender decides the class.
    if v_level = '1' then
      v_gender := v_row.student_gender;
      if v_gender is null or v_gender = 'mixed' then
        v_skipped := v_skipped + 1;
        continue;
      end if;
    else
      v_gender := v_row.class_gender;
    end if;

    v_section := public.next_section(v_row.section, v_level like 'KG%');

    select id into v_target
      from public.classrooms
     where school_id = v_profile.school_id
       and level = v_level
       and gender = v_gender
       and section = v_section;

    if v_target is null then
      insert into public.classrooms (school_id, name, grade, level, gender, section)
      values (
        v_profile.school_id,
        case when v_level like 'KG%'
             then v_level || '-' || v_section
             else v_level || case when v_gender = 'girls' then 'g' else 'b' end || v_section
        end,
        case when v_level like 'KG%' then 'KG ' || right(v_level, 1) else 'Grade ' || v_level end,
        v_level,
        v_gender,
        v_section
      )
      returning id into v_target;
    end if;

    update public.students
       set classroom_id = v_target,
           gender = coalesce(gender, v_gender),
           grade = (select grade from public.classrooms where id = v_target)
     where id = v_row.student_id;

    v_promoted := v_promoted + 1;
  end loop;

  return jsonb_build_object(
    'promoted', v_promoted,
    'graduated', v_graduated,
    'skipped', v_skipped
  );
end;
$$;

revoke all on function public.promote_all_students() from public;
grant execute on function public.promote_all_students() to authenticated;

-- ---------------------------------------------------------------------------
-- New accounts carry their section from sign-up metadata.
--
-- The Edge Function that creates staff logins passes `section_scope` in the
-- user metadata; without this the trigger would drop it and every new teacher
-- account would silently see the whole school.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, school_id, role, full_name, email, phone, section_scope)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'school_id', '')::uuid,
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'parent')::public.user_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'section_scope', ''), 'all')::public.section_scope
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

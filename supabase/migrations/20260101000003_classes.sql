-- ===========================================================================
-- AGS Dismissal — class structure and parent-initiated calls
-- ---------------------------------------------------------------------------
-- AGS names classes by grade, gender and section: "7g1" is grade 7, girls,
-- section 1; "8b2" is grade 8, boys, section 2. Kindergarten (KG1–KG3) is
-- mixed and lettered: "KG2-A". Every class gets its own board.
--
-- Dismissal is driven by parents: their "I'm here" IS the call, so a request
-- is created already in the `called` state and the name turns yellow on the
-- class board. The teacher then marks the student dismissed (`picked_up`).
-- ===========================================================================

create type public.class_gender as enum ('boys', 'girls', 'mixed');

alter table public.classrooms
  add column level   text not null default '',
  add column gender  public.class_gender not null default 'mixed',
  add column section text not null default '';

comment on column public.classrooms.name    is 'Class code teachers use: 7g1, 8b2, KG2-A.';
comment on column public.classrooms.level   is 'KG1–KG3 or 1–12.';
comment on column public.classrooms.section is '1–6 for grades, A–F for kindergarten.';

-- ---------------------------------------------------------------------------
-- Parent / driver: "I'm here" creates the call itself.
-- ---------------------------------------------------------------------------

create or replace function public.request_dismissal(
  p_student_ids uuid[],
  p_note text default null,
  p_vehicle text default null
)
returns setof public.dismissal_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile  public.profiles := public.require_profile();
  v_student  uuid;
  v_existing public.dismissal_requests;
  v_new      public.dismissal_requests;
begin
  if p_student_ids is null or array_length(p_student_ids, 1) is null then
    raise exception 'Choose at least one student.' using errcode = '22023';
  end if;

  foreach v_student in array p_student_ids loop
    if not public.is_guardian_of(v_student) then
      raise exception 'You are not authorised to pick up this student.'
        using errcode = '42501';
    end if;

    select * into v_existing
      from public.dismissal_requests
     where student_id = v_student
       and status in ('requested', 'waiting', 'called', 'ready')
     limit 1;

    if v_existing.id is not null then
      return next v_existing;
      continue;
    end if;

    insert into public.dismissal_requests (
      student_id, status, source, requested_by, called_at, note, vehicle_description
    )
    values (
      v_student,
      'called',
      'parent_app',
      v_profile.id,
      now(),
      nullif(trim(coalesce(p_note, '')), ''),
      coalesce(nullif(trim(coalesce(p_vehicle, '')), ''), v_profile.vehicle_description)
    )
    returning * into v_new;

    return next v_new;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff fallback: a guardian arrived without the app.
-- ---------------------------------------------------------------------------

create or replace function public.staff_call_student(p_student_id uuid)
returns public.dismissal_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile  public.profiles := public.require_staff();
  v_school   uuid;
  v_existing public.dismissal_requests;
  v_new      public.dismissal_requests;
begin
  select school_id into v_school from public.students where id = p_student_id and is_active;

  if v_school is null or v_school <> v_profile.school_id then
    raise exception 'That student is not enrolled at your school.' using errcode = '42501';
  end if;

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

revoke all on function public.staff_call_student(uuid) from public;
grant execute on function public.staff_call_student(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Parents may cancel their own call until the teacher has dismissed the child.
-- ---------------------------------------------------------------------------

create or replace function public.cancel_request(
  p_request_id uuid,
  p_reason text default null
)
returns public.dismissal_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile       public.profiles := public.require_profile();
  v_request       public.dismissal_requests;
  v_parent_cancel boolean;
begin
  select * into v_request from public.dismissal_requests where id = p_request_id;

  if v_request.id is null then
    raise exception 'That dismissal request could not be found.' using errcode = 'P0002';
  end if;

  if v_request.status in ('picked_up', 'cancelled') then
    raise exception 'That dismissal is already closed.' using errcode = '22023';
  end if;

  if v_profile.role in ('admin', 'staff') then
    if v_request.school_id <> v_profile.school_id then
      raise exception 'That dismissal request belongs to another school.' using errcode = '42501';
    end if;
  else
    if not public.is_guardian_of(v_request.student_id) then
      raise exception 'You are not authorised to change this dismissal.' using errcode = '42501';
    end if;

    select allow_parent_cancel into v_parent_cancel
      from public.schools where id = v_request.school_id;

    if not coalesce(v_parent_cancel, false) then
      raise exception 'Your school asks that you contact the office to cancel a pickup.'
        using errcode = '42501';
    end if;
  end if;

  update public.dismissal_requests
     set status        = 'cancelled',
         cancelled_at  = now(),
         cancel_reason = nullif(trim(coalesce(p_reason, '')), '')
   where id = p_request_id
   returning * into v_request;

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- Status changes keep the original call intact: who called and when is set
-- once (by the parent, or by staff on a manual call) and never rewritten by
-- a dismissal or an undo.
-- ---------------------------------------------------------------------------

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
  v_profile public.profiles := public.require_staff();
  v_request public.dismissal_requests;
  v_now     timestamptz := now();
begin
  select * into v_request from public.dismissal_requests where id = p_request_id;

  if v_request.id is null or v_request.school_id <> v_profile.school_id then
    raise exception 'That dismissal request could not be found.' using errcode = 'P0002';
  end if;

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
                          -- A staff-originated call is attributed to whoever completes it;
                          -- a parent's call keeps the parent as the caller.
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
-- A classroom screen (display role) renders a class board, which needs the
-- names on the roster — not just the calls.
-- ---------------------------------------------------------------------------

drop policy if exists "staff read students in their school" on public.students;
create policy "school staff and screens read students"
  on public.students for select to authenticated
  using (school_id = public.current_school_id() and public.is_board_viewer());

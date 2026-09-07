-- ===========================================================================
-- Map Dismissals — dismissal workflow
-- ---------------------------------------------------------------------------
-- The queue is only ever mutated through the functions below. They own the
-- state machine (who may move a request where, and which timestamps that
-- writes) so the same rules apply to every client: web, mobile, or a future
-- kiosk. `dismissal_requests` itself has no INSERT/UPDATE/DELETE policy, so a
-- compromised browser token cannot bypass them.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Queue view — adds the live position a parent sees ("3rd in line").
-- security_invoker keeps the caller's RLS on the underlying table.
-- ---------------------------------------------------------------------------

create or replace view public.dismissal_queue
with (security_invoker = on) as
select
  r.*,
  case
    when r.status in ('requested', 'waiting') then (
      select count(*) + 1
      from public.dismissal_requests peer
      where peer.school_id = r.school_id
        and peer.dismissal_date = r.dismissal_date
        and peer.status in ('requested', 'waiting')
        and peer.requested_at < r.requested_at
    )
  end as queue_position,
  (
    select count(*)
    from public.dismissal_requests peer
    where peer.school_id = r.school_id
      and peer.dismissal_date = r.dismissal_date
      and peer.status in ('requested', 'waiting')
  ) as queue_length
from public.dismissal_requests r;

grant select on public.dismissal_queue to authenticated;

-- ---------------------------------------------------------------------------
-- Internal guards
-- ---------------------------------------------------------------------------

create or replace function public.require_profile()
returns public.profiles
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  if v_profile is null or not v_profile.is_active then
    raise exception 'Your account is not active. Contact a school administrator.'
      using errcode = '28000';
  end if;

  return v_profile;
end;
$$;

create or replace function public.require_staff()
returns public.profiles
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles := public.require_profile();
begin
  if v_profile.role not in ('admin', 'staff') then
    raise exception 'Only school staff can manage the dismissal queue.'
      using errcode = '42501';
  end if;
  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------------
-- Parent / driver: "I'm here"
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

    -- Tapping "I'm Here" twice must not create a duplicate or fail loudly.
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
      student_id, status, source, requested_by, note, vehicle_description
    )
    values (
      v_student,
      'requested',
      'parent_app',
      v_profile.id,
      nullif(trim(coalesce(p_note, '')), ''),
      coalesce(nullif(trim(coalesce(p_vehicle, '')), ''), v_profile.vehicle_description)
    )
    returning * into v_new;

    return next v_new;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: add a student to the queue directly
-- ---------------------------------------------------------------------------

create or replace function public.staff_add_to_queue(
  p_student_id uuid,
  p_note text default null
)
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
    return v_existing;
  end if;

  insert into public.dismissal_requests (student_id, status, source, requested_by, note)
  values (p_student_id, 'waiting', 'staff', v_profile.id, nullif(trim(coalesce(p_note, '')), ''))
  returning * into v_new;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: move a request through the lifecycle (also used for undo)
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
         -- Moving backwards clears the timestamps that no longer apply, so the
         -- board and the parent app never show a stale "Called at ...".
         called_at    = case
                          when p_status = 'waiting' then null
                          when p_status = 'called'  then v_now
                          else coalesce(called_at, v_now)
                        end,
         called_by    = case
                          when p_status = 'waiting' then null
                          when p_status = 'called'  then v_profile.id
                          else coalesce(called_by, v_profile.id)
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
-- Staff: call the next student in line
-- ---------------------------------------------------------------------------

create or replace function public.call_next_student()
returns public.dismissal_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles := public.require_staff();
  v_next    uuid;
begin
  select id into v_next
    from public.dismissal_requests
   where school_id = v_profile.school_id
     and status in ('requested', 'waiting')
   order by requested_at asc
   limit 1
   for update skip locked;

  if v_next is null then
    return null;
  end if;

  return public.set_request_status(v_next, 'called');
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancel — staff always, guardians only while still waiting
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

    if v_request.status not in ('requested', 'waiting') then
      raise exception 'Your student has already been called — please speak to a staff member.'
        using errcode = '22023';
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
-- Staff: close out the day
-- ---------------------------------------------------------------------------

create or replace function public.end_dismissal_session()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles := public.require_staff();
  v_count   integer;
begin
  update public.dismissal_requests
     set status        = 'cancelled',
         cancelled_at  = now(),
         cancel_reason = 'Dismissal session ended'
   where school_id = v_profile.school_id
     and status in ('requested', 'waiting', 'called', 'ready');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — these are SECURITY DEFINER, so revoke the implicit PUBLIC grant.
-- ---------------------------------------------------------------------------

revoke all on function public.require_profile() from public;
revoke all on function public.require_staff() from public;
revoke all on function public.request_dismissal(uuid[], text, text) from public;
revoke all on function public.staff_add_to_queue(uuid, text) from public;
revoke all on function public.set_request_status(uuid, public.dismissal_status) from public;
revoke all on function public.call_next_student() from public;
revoke all on function public.cancel_request(uuid, text) from public;
revoke all on function public.end_dismissal_session() from public;

grant execute on function public.request_dismissal(uuid[], text, text) to authenticated;
grant execute on function public.staff_add_to_queue(uuid, text) to authenticated;
grant execute on function public.set_request_status(uuid, public.dismissal_status) to authenticated;
grant execute on function public.call_next_student() to authenticated;
grant execute on function public.cancel_request(uuid, text) to authenticated;
grant execute on function public.end_dismissal_session() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime — stream queue changes to every connected device.
-- REPLICA IDENTITY FULL lets Realtime apply RLS to UPDATE/DELETE payloads.
-- ---------------------------------------------------------------------------

alter table public.dismissal_requests replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dismissal_requests'
  ) then
    alter publication supabase_realtime add table public.dismissal_requests;
  end if;
exception
  when undefined_object then
    -- No `supabase_realtime` publication (plain Postgres); nothing to do.
    null;
end;
$$;

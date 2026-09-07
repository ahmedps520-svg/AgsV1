-- ===========================================================================
-- Map Dismissals — data-layer test suite
-- ---------------------------------------------------------------------------
-- Exercises the dismissal state machine and every Row Level Security policy
-- as a real Postgres role, so a policy that silently opens up a table fails
-- the build rather than a school's privacy.
--
--   ./supabase/tests/run.sh          (spins up a throwaway Postgres)
--   psql -f supabase/tests/data-layer.test.sql   (against `supabase start`)
-- ===========================================================================
\set ON_ERROR_STOP on
\pset pager off

create or replace function public.assert(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if cond is not true then
    raise exception 'ASSERTION FAILED: %', msg;
  end if;
  raise notice '  ok: %', msg;
end $$;

create or replace function public.act_as(p_user uuid) returns void
language plpgsql security definer as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, false);
end $$;

\set admin   '22222222-2222-4222-8222-222222222221'
\set teacher '22222222-2222-4222-8222-222222222222'
\set board   '22222222-2222-4222-8222-222222222223'
\set parent  '22222222-2222-4222-8222-222222222224'
\set driver  '22222222-2222-4222-8222-222222222225'

\echo '--- 1. Parent taps "I am Here" for both children ---'
select public.act_as(:'parent');
set role authenticated;

select public.assert(count(*) = 2, 'request_dismissal creates one row per student')
from public.request_dismissal(
  array(select id from public.students where last_name = 'AlShehri' order by first_name),
  'Parked in bay 3', 'White Land Cruiser · ABC 1234'
);

select public.assert(
  count(*) = 2 and bool_and(status = 'requested') and bool_and(source = 'parent_app'),
  'both requests start as requested from the parent app')
from public.dismissal_queue where student_name like '%AlShehri%';

select public.assert(
  student_name = 'Ahmed AlShehri' and student_grade = 'Grade 7'
    and classroom_name = '7B' and pickup_number = '104'
    and guardian_name = 'Fatima AlShehri',
  'student + guardian details are snapshotted onto the request')
from public.dismissal_queue where student_name = 'Ahmed AlShehri';

\echo '--- 2. Tapping again is idempotent ---'
select public.assert(count(*) = 2, 'a second tap returns the existing rows')
from public.request_dismissal(array(select id from public.students where last_name = 'AlShehri'));
select public.assert(count(*) = 2, 'no duplicate requests were created')
from public.dismissal_requests where student_name like '%AlShehri%';

\echo '--- 3. RLS: a parent sees only their own children ---'
select public.assert(count(*) = 2, 'parent reads exactly their 2 students') from public.students;
select public.assert(count(*) = 0, 'parent cannot read another family''s student')
from public.students where last_name = 'Rahman';
select public.assert(count(*) = 2, 'parent reads only their own dismissal requests')
from public.dismissal_queue;
select public.assert(count(*) = 0, 'parent cannot read other staff/parent profiles')
from public.profiles where id <> auth.uid();

\echo '--- 4. RLS: a parent cannot drive the queue ---'
do $$
begin
  perform public.set_request_status(
    (select id from public.dismissal_requests limit 1), 'called');
  raise exception 'ASSERTION FAILED: parent was allowed to call a student';
exception
  when insufficient_privilege then
    raise notice '  ok: parent is blocked from calling a student';
end $$;

do $$
begin
  perform public.staff_add_to_queue((select id from public.students limit 1));
  raise exception 'ASSERTION FAILED: parent was allowed to use the staff queue';
exception
  when insufficient_privilege then
    raise notice '  ok: parent is blocked from staff_add_to_queue';
end $$;

\echo '--- 5. RLS: a parent cannot write to tables directly ---'
do $$
begin
  update public.dismissal_requests set status = 'picked_up';
  if found then raise exception 'ASSERTION FAILED: direct UPDATE succeeded'; end if;
  raise notice '  ok: direct UPDATE on the queue affects no rows';
exception
  when insufficient_privilege then raise notice '  ok: direct UPDATE denied';
end $$;

\echo '--- 6. Queue position is visible and correct ---'
select public.assert(
  (select queue_position from public.dismissal_queue where student_name = 'Ahmed AlShehri') = 1
  and (select queue_length from public.dismissal_queue where student_name = 'Ahmed AlShehri') = 2,
  'Ahmed is 1st of 2 in line');

\echo '--- 7. Staff calls the next student ---'
reset role;
select public.act_as(:'teacher');
set role authenticated;

select public.assert(student_name = 'Ahmed AlShehri' and status = 'called' and called_at is not null,
  'call_next_student() calls the longest-waiting student')
from public.call_next_student();

select public.assert(called_by = :'teacher'::uuid, 'the calling staff member is recorded')
from public.dismissal_requests where student_name = 'Ahmed AlShehri';

\echo '--- 8. Ready, then picked up ---'
select public.assert(status = 'ready' and ready_at is not null and called_at is not null,
  'marking ready keeps the called timestamp')
from public.set_request_status(
  (select id from public.dismissal_requests where student_name = 'Ahmed AlShehri'), 'ready');

select public.assert(status = 'picked_up' and picked_up_at is not null and released_by = :'teacher'::uuid,
  'picked up records who released the student')
from public.set_request_status(
  (select id from public.dismissal_requests where student_name = 'Ahmed AlShehri'), 'picked_up');

\echo '--- 9. Undo clears the timestamps that no longer apply ---'
select public.assert(status = 'ready' and picked_up_at is null and released_by is null,
  'undoing a pickup clears picked_up_at')
from public.set_request_status(
  (select id from public.dismissal_requests where student_name = 'Ahmed AlShehri'), 'ready');

select public.assert(status = 'waiting' and called_at is null and ready_at is null,
  'undoing all the way back to waiting clears called_at and ready_at')
from public.set_request_status(
  (select id from public.dismissal_requests where student_name = 'Ahmed AlShehri'), 'waiting');

\echo '--- 10. One active request per student ---'
select public.assert(id = (select id from public.dismissal_requests where student_name = 'Ahmed AlShehri'),
  'adding an already-queued student returns the existing request')
from public.staff_add_to_queue((select id from public.students where first_name = 'Ahmed'));

select public.assert(count(*) = 1, 'still exactly one request for Ahmed')
from public.dismissal_requests where student_name = 'Ahmed AlShehri';

\echo '--- 11. The audit trail records every transition ---'
select public.assert(count(*) >= 6, 'dismissal_events logged each status change')
from public.dismissal_events e
join public.dismissal_requests r on r.id = e.request_id
where r.student_name = 'Ahmed AlShehri';

select public.assert(bool_and(actor_name is not null), 'each event records who did it')
from public.dismissal_events e
join public.dismissal_requests r on r.id = e.request_id
where r.student_name = 'Ahmed AlShehri' and e.from_status is not null;

\echo '--- 12. A parent may cancel while waiting, but not after being called ---'
reset role;
select public.act_as(:'parent');
set role authenticated;

select public.assert(status = 'cancelled' and cancelled_at is not null,
  'parent cancels their own waiting request')
from public.cancel_request(
  (select id from public.dismissal_requests where student_name = 'Salman AlShehri'), 'Bus today');

reset role;
select public.act_as(:'teacher');
set role authenticated;
select public.assert(status = 'called', 'staff calls Ahmed again')
from public.set_request_status(
  (select id from public.dismissal_requests where student_name = 'Ahmed AlShehri'), 'called');

reset role;
select public.act_as(:'parent');
set role authenticated;
do $$
begin
  perform public.cancel_request(
    (select id from public.dismissal_requests where student_name = 'Ahmed AlShehri'));
  raise exception 'ASSERTION FAILED: parent cancelled an already-called student';
exception
  when raise_exception then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    raise notice '  ok: parent blocked from cancelling after the call (%)', sqlerrm;
  when others then
    raise notice '  ok: parent blocked from cancelling after the call (%)', sqlerrm;
end $$;

\echo '--- 13. An authorised driver has the same access as the parent ---'
reset role;
select public.act_as(:'driver');
set role authenticated;
select public.assert(count(*) = 2, 'the authorised driver sees both students') from public.students;

\echo '--- 14. A display account is read-only ---'
reset role;
select public.act_as(:'board');
set role authenticated;
select public.assert(count(*) >= 1, 'the board can read the queue') from public.dismissal_queue;
select public.assert(count(*) = 0, 'the board cannot read the student roster') from public.students;
do $$
begin
  perform public.set_request_status(
    (select id from public.dismissal_requests limit 1), 'ready');
  raise exception 'ASSERTION FAILED: a display account changed the queue';
exception
  when insufficient_privilege then raise notice '  ok: display account cannot change the queue';
end $$;

\echo '--- 15. Staff cannot administer the roster; admins can ---'
reset role;
select public.act_as(:'teacher');
set role authenticated;
do $$
declare v_count int;
begin
  insert into public.students (school_id, first_name, last_name, grade)
  values ((select id from public.schools limit 1), 'Ghost', 'Student', 'Grade 1');
  raise exception 'ASSERTION FAILED: a teacher inserted a student';
exception
  when insufficient_privilege then raise notice '  ok: teachers cannot add students';
end $$;

reset role;
select public.act_as(:'admin');
set role authenticated;
insert into public.students (school_id, first_name, last_name, grade)
values ((select id from public.schools limit 1), 'Ghost', 'Student', 'Grade 1');
select public.assert(count(*) = 1, 'an administrator can add a student')
from public.students where first_name = 'Ghost';
delete from public.students where first_name = 'Ghost';

\echo '--- 16. Ending the session clears everything still open ---'
reset role;
select public.act_as(:'teacher');
set role authenticated;
select public.assert(public.end_dismissal_session() >= 1, 'end_dismissal_session cancels open requests');
select public.assert(count(*) = 0, 'no active requests remain')
from public.dismissal_requests where status in ('requested','waiting','called','ready');

\echo '--- 17. A parent cannot request a student they are not linked to ---'
reset role;
select public.act_as(:'parent');
set role authenticated;
do $$
begin
  perform public.request_dismissal(
    array[(select id from public.students where last_name = 'Rahman')]);
  raise exception 'ASSERTION FAILED: parent requested an unauthorised student';
exception
  when insufficient_privilege then
    raise notice '  ok: parent blocked from requesting an unauthorised student';
end $$;

\echo '--- 18. A signed-out visitor sees nothing ---'
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select public.assert(count(*) = 0, 'anonymous visitors read no students') from public.students;
select public.assert(count(*) = 0, 'anonymous visitors read no dismissal queue') from public.dismissal_queue;
reset role;


\echo '--- 19. Turning off parent cancellation is respected ---'
reset role;
select public.act_as(:'admin');
set role authenticated;
update public.schools set allow_parent_cancel = false;

reset role;
select public.act_as(:'parent');
set role authenticated;
select public.request_dismissal(array[(select id from public.students where first_name = 'Ahmed')]);
do $$
begin
  perform public.cancel_request(
    (select id from public.dismissal_requests
      where student_name = 'Ahmed AlShehri' and status in ('requested','waiting')));
  raise exception 'ASSERTION FAILED: parent cancelled while the school forbids it';
exception
  when insufficient_privilege then
    raise notice '  ok: allow_parent_cancel = false blocks parent cancellation';
end $$;

reset role;
select public.act_as(:'admin');
set role authenticated;
update public.schools set allow_parent_cancel = true;

\echo '--- 20. Staff can put a cancelled dismissal back in the queue ---'
reset role;
select public.act_as(:'teacher');
set role authenticated;
select public.assert(status = 'cancelled', 'a request is cancelled first')
from public.cancel_request(
  (select id from public.dismissal_requests
    where student_name = 'Ahmed AlShehri' and status <> 'cancelled' limit 1), 'Mistake');

select public.assert(status = 'waiting' and cancelled_at is null and cancel_reason is null,
  'restoring a cancelled request clears the cancellation')
from public.set_request_status(
  (select id from public.dismissal_requests
    where student_name = 'Ahmed AlShehri' and status = 'cancelled'
    order by updated_at desc limit 1), 'waiting');

\echo '--- 21. Schools are isolated from each other ---'
reset role;
-- A second school with its own administrator, created out-of-band the way the
-- Supabase admin API would.
insert into public.schools (id, name, slug, timezone)
values ('33333333-3333-4333-8333-333333333333', 'Cedar Grove Academy', 'cedar-grove', 'UTC');
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000',
        '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated',
        'head@cedargrove.demo', now(), now(), '{}'::jsonb,
        jsonb_build_object('full_name','Dana Reid','role','admin',
                           'school_id','33333333-3333-4333-8333-333333333333'));
insert into public.students (school_id, first_name, last_name, grade)
values ('33333333-3333-4333-8333-333333333333', 'Cedar', 'Pupil', 'Grade 4');

select public.act_as('44444444-4444-4444-8444-444444444444');
set role authenticated;

select public.assert(count(*) = 1, 'the other school only sees its own student')
from public.students;
select public.assert(count(*) = 0, 'the other school cannot read our dismissal queue')
from public.dismissal_queue where school_id = '11111111-1111-4111-8111-111111111111';

do $$
begin
  perform public.set_request_status(
    (select id from public.dismissal_requests
      where school_id = '11111111-1111-4111-8111-111111111111' limit 1), 'called');
  raise exception 'ASSERTION FAILED: cross-school status change succeeded';
exception
  when no_data_found or sqlstate 'P0002' then
    raise notice '  ok: cross-school status change is rejected';
end $$;

do $$
begin
  perform public.staff_add_to_queue(
    (select id from public.students where last_name = 'AlShehri' limit 1));
  raise exception 'ASSERTION FAILED: cross-school queue add succeeded';
exception
  when insufficient_privilege then
    raise notice '  ok: cross-school queue add is rejected';
end $$;
reset role;

\echo ''
\echo '================ ALL DATA-LAYER TESTS PASSED ================'

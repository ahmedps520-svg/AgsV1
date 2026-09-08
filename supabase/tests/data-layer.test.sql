-- ===========================================================================
-- AGS Dismissal — data-layer test suite
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
\set parent  '22222222-2222-4222-8222-222222222224'
\set driver  '22222222-2222-4222-8222-222222222225'

-- `:teacher` is the shared boys' dismissal login. Groups 1-21 exercise the
-- state machine rather than section scoping, so give it the whole school for
-- now; group 22 puts it back to 'boys' and proves the confinement.
update public.profiles set section_scope = 'all' where id = :'teacher'::uuid;

\echo '--- 1. Parent taps "I am Here" for two children ---'
select public.act_as(:'parent');
set role authenticated;

select public.assert(count(*) = 2, 'request_dismissal creates one row per student')
from public.request_dismissal(
  array(select id from public.students where last_name = 'AlShehri' and first_name in ('Ahmed','Salman') order by first_name),
  'Parked in bay 3', 'White Land Cruiser · ABC 1234'
);

select public.assert(
  count(*) = 2 and bool_and(status = 'called') and bool_and(called_at is not null)
    and bool_and(source = 'parent_app'),
  'a parent''s "I''m here" creates the call itself: status called, called_at set')
from public.dismissal_queue where student_name like '%AlShehri%';

select public.assert(
  student_name = 'Ahmed AlShehri' and student_grade = 'Grade 7'
    and classroom_name = '7b1' and guardian_name = 'Fatima AlShehri',
  'student, class code and guardian are snapshotted onto the request')
from public.dismissal_queue where student_name = 'Ahmed AlShehri';

\echo '--- 2. Tapping again is idempotent ---'
select public.assert(count(*) = 2, 'a second tap returns the existing rows')
from public.request_dismissal(array(select id from public.students where last_name = 'AlShehri' and first_name in ('Ahmed','Salman')));
select public.assert(count(*) = 2, 'no duplicate requests were created')
from public.dismissal_requests where student_name like '%AlShehri%';

\echo '--- 3. RLS: a parent sees only their own children ---'
select public.assert(count(*) = 3, 'parent reads exactly their 3 children') from public.students;
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

\echo '--- 6. A parent call carries no queue position (it is immediate) ---'
select public.assert(
  (select queue_position from public.dismissal_queue where student_name = 'Ahmed AlShehri') is null,
  'called students are not queued behind anyone');

\echo '--- 7. The teacher dismisses the student from the class board ---'
reset role;
select public.act_as(:'teacher');
set role authenticated;

select public.assert(status = 'picked_up' and picked_up_at is not null and released_by = :'teacher'::uuid,
  'dismissing records who marked the student out')
from public.set_request_status(
  (select id from public.dismissal_requests where student_name = 'Ahmed AlShehri'), 'picked_up');

select public.assert(called_by is null and source = 'parent_app',
  'the call is still attributed to the parent, not the teacher')
from public.dismissal_requests where student_name = 'Ahmed AlShehri';

\echo '--- 8. A guardian who arrived without the app: manual call ---'
select public.assert(status = 'called' and called_by = :'teacher'::uuid and source = 'staff',
  'staff_call_student() turns the tile yellow and records the teacher')
from public.staff_call_student((select id from public.students where first_name = 'Bandar'));

select public.assert(id = (select id from public.dismissal_requests where student_name = 'Bandar AlZahrani'),
  'calling again reuses the same request')
from public.staff_call_student((select id from public.students where first_name = 'Bandar'));

\echo '--- 9. Undo clears the timestamps that no longer apply ---'
select public.assert(status = 'called' and picked_up_at is null and released_by is null
    and called_by is null and called_at is not null,
  'undoing a dismissal puts the name back to yellow and keeps the parent''s call')
from public.set_request_status(
  (select id from public.dismissal_requests where student_name = 'Ahmed AlShehri'), 'called');

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
select public.assert(count(*) >= 4, 'dismissal_events logged each status change')
from public.dismissal_events e
join public.dismissal_requests r on r.id = e.request_id
where r.student_name = 'Ahmed AlShehri';

select public.assert(bool_and(actor_name is not null), 'each event records who did it')
from public.dismissal_events e
join public.dismissal_requests r on r.id = e.request_id
where r.student_name = 'Ahmed AlShehri' and e.from_status is not null;

\echo '--- 12. A parent may cancel their call until the teacher dismisses ---'
reset role;
select public.act_as(:'parent');
set role authenticated;

select public.assert(status = 'cancelled' and cancelled_at is not null,
  'parent cancels their own call while the child is still in class')
from public.cancel_request(
  (select id from public.dismissal_requests where student_name = 'Salman AlShehri'), 'Bus today');

reset role;
select public.act_as(:'teacher');
set role authenticated;
select public.assert(status = 'picked_up', 'teacher dismisses Ahmed')
from public.set_request_status(
  (select id from public.dismissal_requests where student_name = 'Ahmed AlShehri'), 'picked_up');

reset role;
select public.act_as(:'parent');
set role authenticated;
do $$
begin
  perform public.cancel_request(
    (select id from public.dismissal_requests where student_name = 'Ahmed AlShehri'));
  raise exception 'ASSERTION FAILED: parent cancelled a dismissed student';
exception
  when raise_exception then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    raise notice '  ok: parent blocked from cancelling after dismissal (%)', sqlerrm;
  when others then
    raise notice '  ok: parent blocked from cancelling after dismissal (%)', sqlerrm;
end $$;

\echo '--- 13. An authorised driver has the same access as the parent ---'
reset role;
select public.act_as(:'driver');
set role authenticated;
select public.assert(count(*) = 3, 'the authorised driver sees the same three children') from public.students;

\echo '--- 14. A teacher has full use of every class board ---'
reset role;
select public.act_as(:'teacher');
set role authenticated;
select public.assert(count(*) > 0, 'a teacher reads the roster their boards render') from public.students;
select public.assert(count(*) >= 0, 'a teacher reads the calls') from public.dismissal_queue;

select public.assert(status = 'called',
  'a teacher can call a student on any class board in their school')
from public.staff_call_student((select id from public.students where first_name = 'Noura'));

select public.assert(status = 'picked_up', 'and dismiss them again')
from public.set_request_status(
  (select id from public.dismissal_requests where student_name like 'Noura%' limit 1), 'picked_up');

select public.assert(count(*) > 0, 'a teacher reads guardian names inside their own school')
from public.profiles where role = 'parent';

select public.assert(count(*) = 0, 'but no profile from another school')
from public.profiles where school_id <> public.current_school_id();

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
      where student_name = 'Ahmed AlShehri' and status in ('requested','waiting','called')));
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
-- Test 19 left Ahmed with an open call (the parent re-called him); cancel that one.
select public.assert(status = 'cancelled', 'an open call is cancelled first')
from public.cancel_request(
  (select id from public.dismissal_requests
    where student_name = 'Ahmed AlShehri' and status in ('requested','waiting','called','ready') limit 1),
  'Mistake');

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

\echo '--- 22. A shared section account is confined to its own section ---'
reset role;
-- Back to what the school actually deploys: one shared login per section.
update public.profiles set section_scope = 'boys' where id = :'teacher'::uuid;

select public.act_as(:'teacher');
set role authenticated;

select public.assert(count(*) > 0, 'the boys account reads boys classes')
from public.classrooms where gender = 'boys';
select public.assert(count(*) = 0, 'the boys account cannot read a girls class')
from public.classrooms where gender = 'girls';
select public.assert(count(*) = 0, 'nor a mixed kindergarten class')
from public.classrooms where gender = 'mixed';

select public.assert(count(*) = 0, 'the boys account cannot read a girls student')
from public.students where first_name in ('Noura', 'Hessa');
select public.assert(count(*) > 0, 'but reads boys students')
from public.students where first_name = 'Ahmed';

do $$
begin
  perform public.staff_call_student(
    (select id from public.students where first_name = 'Noura' limit 1));
  raise exception 'ASSERTION FAILED: the boys account called a girls student';
exception
  when insufficient_privilege then
    raise notice '  ok: the boys account cannot call a girls student';
  when others then
    -- RLS hides the row entirely, which is an even tighter failure.
    raise notice '  ok: the boys account cannot call a girls student (%)', sqlerrm;
end $$;

select public.assert(status = 'called', 'and can call a boys student on its own board')
from public.staff_call_student((select id from public.students where first_name = 'Ahmed'));

\echo '--- 23. Girls calls stay invisible to the boys account ---'
reset role;
select public.act_as(:'admin');
set role authenticated;
select public.staff_call_student((select id from public.students where first_name = 'Noura'));

reset role;
select public.act_as(:'teacher');
set role authenticated;
select public.assert(count(*) = 0, 'a girls call never reaches the boys board')
from public.dismissal_queue where student_name like 'Noura%';
select public.assert(count(*) > 0, 'while its own boys calls are visible')
from public.dismissal_queue where student_name like 'Ahmed%';

\echo '--- 24. End-of-year promotion ---'
reset role;
select public.act_as(:'admin');
set role authenticated;

-- A leaver to prove Grade 12 is removed, and a KG student to prove the mixed
-- kindergarten splits correctly into a gendered Grade 1 class.
insert into public.classrooms (school_id, name, grade, level, gender, section)
values ('11111111-1111-4111-8111-111111111111', '12b1', 'Grade 12', '12', 'boys', '1');
insert into public.students (school_id, first_name, last_name, grade, gender, classroom_id)
values ('11111111-1111-4111-8111-111111111111', 'Faris', 'AlLeaver', 'Grade 12', 'boys',
        (select id from public.classrooms where name = '12b1'));
update public.students set gender = 'girls'
 where first_name = 'Sara' and last_name = 'AlShammari';

-- A KG3 girl: leaving kindergarten is the only move that needs the student's
-- own gender, because Grade 1 is split and KG is not.
insert into public.classrooms (school_id, name, grade, level, gender, section)
values ('11111111-1111-4111-8111-111111111111', 'KG3-B', 'KG 3', 'KG3', 'mixed', 'B');
insert into public.students (school_id, first_name, last_name, grade, gender, classroom_id)
values ('11111111-1111-4111-8111-111111111111', 'Jana', 'AlKindy', 'KG 3', 'girls',
        (select id from public.classrooms where name = 'KG3-B'));
-- And one with no gender recorded, which cannot be placed.
insert into public.students (school_id, first_name, last_name, grade, gender, classroom_id)
values ('11111111-1111-4111-8111-111111111111', 'Unknown', 'AlNogender', 'KG 3', null,
        (select id from public.classrooms where name = 'KG3-B'));

do $$
declare v_result jsonb;
begin
  v_result := public.promote_all_students();
  raise notice '  promotion: %', v_result;
  if (v_result ->> 'graduated')::int < 1 then
    raise exception 'ASSERTION FAILED: Grade 12 was not removed';
  end if;
  if (v_result ->> 'promoted')::int < 5 then
    raise exception 'ASSERTION FAILED: too few students promoted';
  end if;
  if (v_result ->> 'skipped')::int <> 1 then
    raise exception 'ASSERTION FAILED: expected exactly one unplaceable student, got %',
      v_result ->> 'skipped';
  end if;
end $$;

select public.assert(count(*) = 0, 'the Grade 12 leaver is gone')
from public.students where last_name = 'AlLeaver';

select public.assert(
  (select c.name from public.students s join public.classrooms c on c.id = s.classroom_id
    where s.first_name = 'Ahmed' and s.last_name = 'AlShehri') = '8b1',
  'Ahmed moved from 7b1 to 8b1');

select public.assert(
  (select c.level from public.students s join public.classrooms c on c.id = s.classroom_id
    where s.first_name = 'Sara' and s.last_name = 'AlShammari') = 'KG2',
  'the KG1 girl moved up to KG2');

select public.assert(
  (select c.level from public.students s join public.classrooms c on c.id = s.classroom_id
    where s.first_name = 'Maryam') = 'KG3',
  'a KG2 student moves up inside kindergarten, no gender needed');

select public.assert(
  (select c.name from public.students s join public.classrooms c on c.id = s.classroom_id
    where s.first_name = 'Jana') = '1g2',
  'the KG3 girl lands in Grade 1 girls, section B mapped to 2');

select public.assert(
  (select c.level from public.students s join public.classrooms c on c.id = s.classroom_id
    where s.first_name = 'Unknown') = 'KG3',
  'the student with no recorded gender stays put rather than being misplaced');
reset role;

\echo ''
\echo '================ ALL DATA-LAYER TESTS PASSED ================'

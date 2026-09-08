-- ===========================================================================
-- AGS Dismissal — local development seed
-- ---------------------------------------------------------------------------
-- Loaded automatically by `supabase db reset` for LOCAL development, so the
-- app has a school, some classes and a handful of students to work against.
-- It creates sign-in accounts with well-known passwords: never run it against
-- the live project. The real project is bootstrapped with `supabase/setup.sql`
-- and staff logins are created from the admin screen.
--
--   admin@ags.edu.sa           / Dismissal123!   administrator, all sections
--   dismissal.boys@ags.edu.sa  / dismissal@ags$  teacher, boys classes
--   dismissal.girls@ags.edu.sa / dismissal@ags$  teacher, girls classes
--   dismissal.kg@ags.edu.sa    / dismissal@ags$  teacher, kindergarten
--   parent@ags.edu.sa          / Dismissal123!   parent of Ahmed, Salman, Noura
--   driver@ags.edu.sa          / Dismissal123!   authorised driver
-- ===========================================================================

do $$
declare
  v_school   uuid := '11111111-1111-4111-8111-111111111111';
  v_admin    uuid := '22222222-2222-4222-8222-222222222221';
  v_boys     uuid := '22222222-2222-4222-8222-222222222222';
  v_girls    uuid := '22222222-2222-4222-8222-222222222223';
  v_kg       uuid := '22222222-2222-4222-8222-222222222226';
  v_parent   uuid := '22222222-2222-4222-8222-222222222224';
  v_driver   uuid := '22222222-2222-4222-8222-222222222225';

  v_user     record;
  v_room     record;
  v_student  record;
  v_rooms    jsonb;
  v_ahmed    uuid;
  v_salman   uuid;
  v_noura    uuid;
begin
  -- ---------------------------------------------------------------- school --
  insert into public.schools (id, name, slug, timezone, dismissal_start, dismissal_end, board_message)
  values (
    v_school,
    'Advanced Generations International Schools',
    'ags',
    'Asia/Riyadh',
    null,
    null,
    null
  )
  on conflict (id) do nothing;

  -- ----------------------------------------------------------------- users --
  -- One shared login per section is deliberate: every teacher in the boys
  -- building signs in with the same account and picks their own class.
  for v_user in
    select * from (values
      (v_admin,  'admin@ags.edu.sa',           'Dismissal123!',  'School Administrator', 'admin', 'all'),
      (v_boys,   'dismissal.boys@ags.edu.sa',  'dismissal@ags$', 'Boys Dismissal',       'staff', 'boys'),
      (v_girls,  'dismissal.girls@ags.edu.sa', 'dismissal@ags$', 'Girls Dismissal',      'staff', 'girls'),
      (v_kg,     'dismissal.kg@ags.edu.sa',    'dismissal@ags$', 'Kindergarten',         'staff', 'mixed'),
      (v_parent, 'parent@ags.edu.sa',          'Dismissal123!',  'Fatima AlShehri',      'parent', 'all'),
      (v_driver, 'driver@ags.edu.sa',          'Dismissal123!',  'Yousef Karim',         'parent', 'all')
    ) as t(id, email, password, full_name, role, scope)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_user.id,
      'authenticated',
      'authenticated',
      v_user.email,
      extensions.crypt(v_user.password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', v_user.full_name,
        'role', v_user.role,
        'school_id', v_school::text,
        'section_scope', v_user.scope
      ),
      now(), now(), '', '', '', ''
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    values (
      gen_random_uuid(),
      v_user.id,
      v_user.id::text,
      jsonb_build_object('sub', v_user.id::text, 'email', v_user.email, 'email_verified', true),
      'email',
      now(), now(), now()
    )
    on conflict do nothing;

    -- The on_auth_user_created trigger builds the profile; make sure the
    -- school, role and section are correct even if the row already existed.
    update public.profiles
       set school_id     = v_school,
           role          = v_user.role::public.user_role,
           full_name     = v_user.full_name,
           email         = v_user.email,
           section_scope = v_user.scope::public.section_scope
     where id = v_user.id;
  end loop;

  update public.profiles set vehicle_description = 'White Toyota Land Cruiser · ABC 1234' where id = v_parent;
  update public.profiles set vehicle_description = 'Grey Hyundai Sonata · XYZ 8891'      where id = v_driver;

  -- ------------------------------------------------------------ classrooms --
  -- AGS codes: KG lettered and mixed; grades split into boys (b) / girls (g).
  for v_room in
    select * from (values
      ('KG1-A', 'KG1', 'mixed', 'A'),
      ('KG2-A', 'KG2', 'mixed', 'A'),
      ('1b1',   '1',   'boys',  '1'),
      ('3b1',   '3',   'boys',  '1'),
      ('5g1',   '5',   'girls', '1'),
      ('7b1',   '7',   'boys',  '1'),
      ('7g1',   '7',   'girls', '1'),
      ('8b1',   '8',   'boys',  '1')
    ) as t(name, level, gender, section)
  loop
    insert into public.classrooms (school_id, name, grade, level, gender, section)
    values (
      v_school,
      v_room.name,
      case when v_room.level like 'KG%' then 'KG ' || right(v_room.level, 1) else 'Grade ' || v_room.level end,
      v_room.level,
      v_room.gender::public.class_gender,
      v_room.section
    )
    on conflict (school_id, name) do nothing;
  end loop;

  select jsonb_object_agg(name, id) into v_rooms
    from public.classrooms where school_id = v_school;

  -- -------------------------------------------------------------- students --
  for v_student in
    select * from (values
      ('Ahmed',   'AlShehri',  '7b1',   'boys'),
      ('Salman',  'AlShehri',  '3b1',   'boys'),
      ('Noura',   'AlShehri',  '5g1',   'girls'),
      ('Faisal',  'AlQahtani', '7b1',   'boys'),
      ('Turki',   'AlGhamdi',  '7b1',   'boys'),
      ('Reem',    'AlOtaibi',  '7g1',   'girls'),
      ('Lama',    'AlHarbi',   '7g1',   'girls'),
      ('Zayd',    'AlDosari',  '3b1',   'boys'),
      ('Maryam',  'AlMutairi', 'KG2-A', 'girls'),
      ('Bandar',  'AlZahrani', '8b1',   'boys'),
      ('Hessa',   'AlSubaie',  '5g1',   'girls'),
      ('Nawaf',   'AlAmri',    '1b1',   'boys'),
      ('Sara',    'AlShammari','KG1-A', 'girls')
    ) as t(first_name, last_name, room, gender)
  loop
    if not exists (
      select 1 from public.students
      where school_id = v_school
        and first_name = v_student.first_name
        and last_name = v_student.last_name
    ) then
      insert into public.students (school_id, first_name, last_name, grade, classroom_id, gender)
      values (
        v_school,
        v_student.first_name,
        v_student.last_name,
        (select grade from public.classrooms where id = (v_rooms ->> v_student.room)::uuid),
        (v_rooms ->> v_student.room)::uuid,
        v_student.gender::public.class_gender
      );
    end if;
  end loop;

  select id into v_ahmed  from public.students where school_id = v_school and first_name = 'Ahmed'  and last_name = 'AlShehri';
  select id into v_salman from public.students where school_id = v_school and first_name = 'Salman' and last_name = 'AlShehri';
  select id into v_noura  from public.students where school_id = v_school and first_name = 'Noura'  and last_name = 'AlShehri';

  -- --------------------------------------------------- pickup permissions --
  insert into public.guardians (student_id, profile_id, relationship, is_primary, can_pickup)
  values
    (v_ahmed,  v_parent, 'Mother', true,  true),
    (v_salman, v_parent, 'Mother', true,  true),
    (v_noura,  v_parent, 'Mother', true,  true),
    (v_ahmed,  v_driver, 'Authorised driver', false, true),
    (v_salman, v_driver, 'Authorised driver', false, true),
    (v_noura,  v_driver, 'Authorised driver', false, true)
  on conflict (student_id, profile_id) do nothing;
end;
$$;

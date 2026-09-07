-- ===========================================================================
-- AGS Dismissal — demo seed
-- ---------------------------------------------------------------------------
-- Loaded automatically by `supabase db reset` for LOCAL development.
-- It creates sign-in accounts with well-known passwords: never run it against
-- a production project.
--
--   admin@ags.demo    / Dismissal123!   (administrator)
--   teacher@ags.demo  / Dismissal123!   (staff)
--   board@ags.demo    / Dismissal123!   (TV display, read only)
--   parent@ags.demo   / Dismissal123!   (parent of Ahmed + Salman)
--   driver@ags.demo   / Dismissal123!   (authorised driver)
-- ===========================================================================

do $$
declare
  v_school   uuid := '11111111-1111-4111-8111-111111111111';
  v_admin    uuid := '22222222-2222-4222-8222-222222222221';
  v_teacher  uuid := '22222222-2222-4222-8222-222222222222';
  v_board    uuid := '22222222-2222-4222-8222-222222222223';
  v_parent   uuid := '22222222-2222-4222-8222-222222222224';
  v_driver   uuid := '22222222-2222-4222-8222-222222222225';
  v_password text := 'Dismissal123!';

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
  for v_user in
    select * from (values
      (v_admin,   'admin@ags.demo',   'Layla Haddad',    'admin'),
      (v_teacher, 'teacher@ags.demo', 'Omar Nasser',     'staff'),
      (v_board,   'board@ags.demo',   'Main Lobby TV',   'display'),
      (v_parent,  'parent@ags.demo',  'Fatima AlShehri', 'parent'),
      (v_driver,  'driver@ags.demo',  'Yousef Karim',    'parent')
    ) as t(id, email, full_name, role)
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
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_user.full_name, 'role', v_user.role, 'school_id', v_school::text),
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
    -- school + role are correct even if the row already existed.
    update public.profiles
       set school_id = v_school,
           role      = v_user.role::public.user_role,
           full_name = v_user.full_name,
           email     = v_user.email
     where id = v_user.id;
  end loop;

  update public.profiles set vehicle_description = 'White Toyota Land Cruiser · ABC 1234' where id = v_parent;
  update public.profiles set vehicle_description = 'Grey Hyundai Sonata · XYZ 8891'      where id = v_driver;

  -- ------------------------------------------------------------ classrooms --
  -- AGS codes: KG lettered and mixed; grades split into boys (b) / girls (g).
  for v_room in
    select * from (values
      ('KG1-A', 'KG1', 'mixed', 'A', null::uuid),
      ('KG2-A', 'KG2', 'mixed', 'A', null::uuid),
      ('1b1',   '1',   'boys',  '1', null::uuid),
      ('3b1',   '3',   'boys',  '1', null::uuid),
      ('5g1',   '5',   'girls', '1', null::uuid),
      ('7b1',   '7',   'boys',  '1', v_teacher),
      ('7g1',   '7',   'girls', '1', null::uuid),
      ('8b1',   '8',   'boys',  '1', null::uuid)
    ) as t(name, level, gender, section, teacher_id)
  loop
    insert into public.classrooms (school_id, name, grade, level, gender, section, teacher_id)
    values (
      v_school,
      v_room.name,
      case when v_room.level like 'KG%' then 'KG ' || right(v_room.level, 1) else 'Grade ' || v_room.level end,
      v_room.level,
      v_room.gender::public.class_gender,
      v_room.section,
      v_room.teacher_id
    )
    on conflict (school_id, name) do nothing;
  end loop;

  select jsonb_object_agg(name, id) into v_rooms
    from public.classrooms where school_id = v_school;

  -- -------------------------------------------------------------- students --
  for v_student in
    select * from (values
      ('Ahmed',   'AlShehri',  'Grade 7', '7b1',   null),
      ('Salman',  'AlShehri',  'Grade 3', '3b1',   null),
      ('Noura',   'AlShehri',  'Grade 5', '5g1',   null),
      ('Faisal',  'AlQahtani', 'Grade 7', '7b1',   null),
      ('Turki',   'AlGhamdi',  'Grade 7', '7b1',   null),
      ('Reem',    'AlOtaibi',  'Grade 7', '7g1',   null),
      ('Lama',    'AlHarbi',   'Grade 7', '7g1',   null),
      ('Zayd',    'AlDosari',  'Grade 3', '3b1',   null),
      ('Maryam',  'AlMutairi', 'KG 2',    'KG2-A', null),
      ('Bandar',  'AlZahrani', 'Grade 8', '8b1',   null),
      ('Hessa',   'AlSubaie',  'Grade 5', '5g1',   null),
      ('Nawaf',   'AlAmri',    'Grade 1', '1b1',   null),
      ('Sara',    'AlShammari','KG 1',    'KG1-A', null)
    ) as t(first_name, last_name, grade, room, pickup_number)
  loop
    if not exists (
      select 1 from public.students
      where school_id = v_school
        and first_name = v_student.first_name
        and last_name = v_student.last_name
    ) then
      insert into public.students (school_id, first_name, last_name, grade, classroom_id, pickup_number)
      values (
        v_school,
        v_student.first_name,
        v_student.last_name,
        v_student.grade,
        (v_rooms ->> v_student.room)::uuid,
        v_student.pickup_number
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

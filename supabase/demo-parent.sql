-- ===========================================================================
-- AGS Dismissal — a parent you can try the app with
-- ---------------------------------------------------------------------------
-- Creates one parent login and three pretend students in real classes, so you
-- can watch the whole loop on the live site:
--
--   1. Sign in as the parent below on a phone, tap "I'm here".
--   2. Sign in as dismissal.boys@ags.edu.sa on another device, open 7b1.
--      Ahmed's name is there in yellow within a second.
--   3. Tap Dismiss. It turns grey, and the parent's phone updates.
--
-- Everything it creates is named "(demo)" so it is easy to find, and the
-- cleanup at the bottom of this file removes all of it in one go.
--
-- Change the two values below first. Do not leave the default password on a
-- school that has real families in it.
-- ===========================================================================

do $$
declare
  -- ------------------------------------------------------------- settings --
  v_parent_email text := 'demo.parent@ags.edu.sa';
  v_parent_pw    text := 'demo-parent-2026';
  -- ----------------------------------------------------------------------- --

  v_school uuid;
  v_parent uuid;
  v_row    record;
  v_class  uuid;
  v_id     uuid;
begin
  if to_regclass('public.students') is null then
    raise exception 'The AGS Dismissal schema is not installed yet. Run supabase/install.sql first.'
      using errcode = '42P01';
  end if;

  select id into v_school from public.schools where slug = 'ags';
  if v_school is null then
    raise exception 'No school found. Run supabase/setup.sql first.' using errcode = 'P0002';
  end if;

  -- ------------------------------------------------------------- the parent --
  select id into v_parent from auth.users where lower(email) = lower(v_parent_email);

  if v_parent is null then
    v_parent := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_parent, 'authenticated', 'authenticated', lower(v_parent_email),
      extensions.crypt(v_parent_pw, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Fatima AlShehri (demo)', 'role', 'parent',
                         'school_id', v_school::text),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    )
    values (
      gen_random_uuid(), v_parent, v_parent::text,
      jsonb_build_object('sub', v_parent::text, 'email', lower(v_parent_email),
                         'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into public.profiles (id, school_id, role, full_name, email,
                               vehicle_description, is_active)
  values (v_parent, v_school, 'parent', 'Fatima AlShehri (demo)',
          lower(v_parent_email), 'White Toyota Land Cruiser · ABC 1234', true)
  on conflict (id) do update
    set school_id           = excluded.school_id,
        role                = 'parent',
        full_name           = excluded.full_name,
        email               = excluded.email,
        vehicle_description = excluded.vehicle_description,
        is_active           = true;

  -- ---------------------------------------------------------- the children --
  -- Deliberately spread across three classes and both sections: it proves the
  -- board only shows the children who belong to the class you have open, and
  -- that the boys' login never sees the daughter.
  for v_row in
    select * from (values
      ('Ahmed',  '7b1', 'boys'),
      ('Salman', '3b1', 'boys'),
      ('Noura',  '5g1', 'girls')
    ) as t(first_name, class_code, gender)
  loop
    select id into v_class
      from public.classrooms
     where school_id = v_school and lower(name) = lower(v_row.class_code);

    if v_class is null then
      raise exception 'Class % does not exist. Run supabase/add-classes.sql first.',
        v_row.class_code using errcode = 'P0002';
    end if;

    select id into v_id
      from public.students
     where school_id = v_school
       and first_name = v_row.first_name
       and last_name = 'AlShehri (demo)';

    if v_id is null then
      insert into public.students (school_id, first_name, last_name, grade,
                                   classroom_id, gender)
      values (
        v_school, v_row.first_name, 'AlShehri (demo)',
        (select grade from public.classrooms where id = v_class),
        v_class, v_row.gender::public.class_gender
      )
      returning id into v_id;
    else
      update public.students
         set classroom_id = v_class,
             gender = v_row.gender::public.class_gender,
             is_active = true
       where id = v_id;
    end if;

    -- The link that actually grants pickup. Without it a parent sees nothing.
    insert into public.guardians (student_id, profile_id, relationship,
                                  is_primary, can_pickup)
    values (v_id, v_parent, 'Mother', true, true)
    on conflict (student_id, profile_id) do update set can_pickup = true;
  end loop;

  raise notice 'Demo ready. Sign in as % with the password you set above.', v_parent_email;
end;
$$;

select
  s.first_name || ' ' || s.last_name as student,
  c.name                             as class,
  p.email                            as parent_signs_in_as
from public.students s
join public.classrooms c on c.id = s.classroom_id
join public.guardians g on g.student_id = s.id
join public.profiles p on p.id = g.profile_id
where s.last_name = 'AlShehri (demo)'
order by c.name;

-- ===========================================================================
-- To remove the demo afterwards, run this on its own:
--
--   delete from public.students where last_name = 'AlShehri (demo)';
--   delete from auth.users where email = 'demo.parent@ags.edu.sa';
--
-- Deleting the student removes their dismissal history and guardian links with
-- them; deleting the login removes its profile.
-- ===========================================================================

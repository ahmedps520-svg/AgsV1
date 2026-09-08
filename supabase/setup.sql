-- ===========================================================================
-- AGS Dismissal — one-time project setup
-- ---------------------------------------------------------------------------
-- Run this ONCE in the Supabase SQL editor, after the migrations in
-- `supabase/migrations/` have been applied. It creates:
--
--   • the school record
--   • every class: KG1–KG3 (mixed) and Grades 1–12 split boys / girls
--   • the four staff logins the school signs in with
--
-- It creates no students and no parents — add those from the admin screens,
-- or import them later. Running it a second time changes nothing: every
-- statement is written to be safe to repeat.
--
-- BEFORE YOU RUN IT, edit the four values in the `settings` block below.
-- Change the passwords afterwards from the app if you paste this anywhere
-- shared: anyone who reads this file can read them.
-- ===========================================================================

do $$
declare
  -- ------------------------------------------------------------- settings --
  v_school_name  text := 'Advanced Generations International Schools';
  v_timezone     text := 'Asia/Riyadh';

  -- The one password every teacher in a building types. Make it long; it is
  -- shared by dozens of people and it is the only thing between a stranger and
  -- your students' names.
  v_shared_pw    text := 'dismissal@ags$';

  -- The administrator account. Give this one a password of its own — it can
  -- add and remove students and move the whole school up a grade.
  v_admin_email  text := 'admin@ags.edu.sa';
  v_admin_pw     text := 'change-me-before-you-run-this';

  -- How many sections each grade is divided into. Six is the maximum the class
  -- codes allow (7b1 … 7b6). Extra classes can be added from the app.
  v_sections     int  := 2;
  -- Kindergarten sections are lettered: A, B, … up to this many.
  v_kg_sections  int  := 2;
  -- ----------------------------------------------------------------------- --

  v_school   uuid;
  v_user     record;
  v_level    text;
  v_gender   text;
  v_section  int;
  v_code     text;
  v_id       uuid;
begin
  -- ---------------------------------------------------------------- school --
  select id into v_school from public.schools where slug = 'ags';

  if v_school is null then
    insert into public.schools (name, slug, timezone)
    values (v_school_name, 'ags', v_timezone)
    returning id into v_school;
  else
    update public.schools set name = v_school_name, timezone = v_timezone where id = v_school;
  end if;

  -- ----------------------------------------------------------------- users --
  -- One shared login per building. `section_scope` is the security boundary:
  -- Row Level Security uses it to hide the other half of the school, so the
  -- boys' password being passed around cannot expose the girls' classes.
  for v_user in
    select * from (values
      (v_admin_email,               v_admin_pw, 'School Administrator', 'admin', 'all'),
      ('dismissal.boys@ags.edu.sa',  v_shared_pw, 'Boys Dismissal',      'staff', 'boys'),
      ('dismissal.girls@ags.edu.sa', v_shared_pw, 'Girls Dismissal',     'staff', 'girls'),
      ('dismissal.kg@ags.edu.sa',    v_shared_pw, 'Kindergarten',        'staff', 'mixed')
    ) as t(email, password, full_name, role, scope)
  loop
    select id into v_id from auth.users where lower(email) = lower(v_user.email);

    if v_id is null then
      v_id := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      )
      values (
        '00000000-0000-0000-0000-000000000000',
        v_id,
        'authenticated',
        'authenticated',
        lower(v_user.email),
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
      );

      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      )
      values (
        gen_random_uuid(),
        v_id,
        v_id::text,
        jsonb_build_object('sub', v_id::text, 'email', lower(v_user.email), 'email_verified', true),
        'email',
        now(), now(), now()
      );
    end if;

    -- The on_auth_user_created trigger writes the profile. Make sure the
    -- school, role and section are right whether the row is new or not.
    update public.profiles
       set school_id     = v_school,
           role          = v_user.role::public.user_role,
           full_name     = v_user.full_name,
           email         = lower(v_user.email),
           section_scope = v_user.scope::public.section_scope,
           is_active     = true
     where id = v_id;
  end loop;

  -- ------------------------------------------------------------ classrooms --
  -- Kindergarten is mixed and lettered: KG1-A, KG1-B …
  foreach v_level in array array['KG1', 'KG2', 'KG3'] loop
    for v_section in 1 .. v_kg_sections loop
      v_code := v_level || '-' || chr(64 + v_section);
      insert into public.classrooms (school_id, name, grade, level, gender, section)
      values (v_school, v_code, 'KG ' || right(v_level, 1), v_level, 'mixed', chr(64 + v_section))
      on conflict (school_id, name) do nothing;
    end loop;
  end loop;

  -- Grades 1–12 are split, and numbered: 7b1, 7g1, 7b2 …
  for v_level in select generate_series(1, 12)::text loop
    foreach v_gender in array array['boys', 'girls'] loop
      for v_section in 1 .. v_sections loop
        v_code := v_level || substr(v_gender, 1, 1) || v_section;
        insert into public.classrooms (school_id, name, grade, level, gender, section)
        values (v_school, v_code, 'Grade ' || v_level, v_level,
                v_gender::public.class_gender, v_section::text)
        on conflict (school_id, name) do nothing;
      end loop;
    end loop;
  end loop;

  raise notice 'AGS Dismissal is set up: % classes, 4 staff logins.',
    (select count(*) from public.classrooms where school_id = v_school);
end;
$$;

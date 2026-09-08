-- ===========================================================================
-- AGS Dismissal — creating logins without a service-role key
-- ---------------------------------------------------------------------------
-- Accounts used to be created by an Edge Function, because writing to
-- `auth.users` needs the service-role key and a static site can never hold
-- one. That was true but impractical: deploying an Edge Function needs the
-- Supabase CLI on a computer, and the person setting this school up does it
-- from a phone. So the office could not add a single parent.
--
-- This does the same job from inside the database, where the privilege already
-- lives. It is SECURITY DEFINER, so it runs as the schema owner — which is
-- exactly why every check below has to be done here rather than in the caller:
-- the browser is not trusted with any of them.
-- ===========================================================================

create or replace function public.admin_create_account(
  p_email         text,
  p_full_name     text,
  p_role          public.user_role,
  p_password      text default null,
  p_section_scope public.section_scope default 'all',
  p_phone         text default null,
  p_vehicle       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_caller   public.profiles;
  v_email    text := lower(trim(coalesce(p_email, '')));
  v_name     text := trim(coalesce(p_full_name, ''));
  v_password text := coalesce(p_password, '');
  v_scope    public.section_scope;
  v_id       uuid := gen_random_uuid();
  v_words    text[] := array['Bright','Falcon','Harbor','Lantern','Meadow','Orchard','Summit','Willow'];
  v_made     boolean := false;
begin
  -- 1. Only an active administrator, and only into their own school.
  select * into v_caller from public.profiles where id = auth.uid();

  if v_caller.id is null or not v_caller.is_active or v_caller.role <> 'admin' then
    raise exception 'Only a school administrator can create accounts.'
      using errcode = '42501';
  end if;

  if v_caller.school_id is null then
    raise exception 'Your account is not linked to a school yet.'
      using errcode = '22023';
  end if;

  -- 2. Validate before writing anything.
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;

  if v_name = '' then
    raise exception 'Enter a full name.' using errcode = '22023';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'That email address already has an account.' using errcode = '23505';
  end if;

  -- A readable one-time password the office can read out over the phone.
  if v_password = '' then
    v_password := v_words[1 + floor(random() * array_length(v_words, 1))::int]
                  || '-' || lpad(floor(random() * 10000)::text, 4, '0');
    v_made := true;
  elsif length(v_password) < 10 then
    raise exception 'Choose a password of at least 10 characters.' using errcode = '22023';
  end if;

  -- Only staff are confined to a section; everyone else sees what their role
  -- allows. Never take the scope on trust for a role it does not apply to.
  v_scope := case when p_role = 'staff' then coalesce(p_section_scope, 'all') else 'all' end;

  -- 3. Create the login.
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
    v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', v_name,
      'role', p_role::text,
      'school_id', v_caller.school_id::text,
      'section_scope', v_scope::text
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
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email',
    now(), now(), now()
  );

  -- The on_auth_user_created trigger normally writes the profile. Upsert so a
  -- project where that trigger could not be installed still gets one: a login
  -- without a profile signs in to an empty app.
  insert into public.profiles (
    id, school_id, role, full_name, email, phone, vehicle_description, section_scope, is_active
  )
  values (
    v_id,
    v_caller.school_id,
    p_role,
    v_name,
    v_email,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_vehicle, '')), ''),
    v_scope,
    true
  )
  on conflict (id) do update
    set school_id           = excluded.school_id,
        role                = excluded.role,
        full_name           = excluded.full_name,
        email               = excluded.email,
        phone               = excluded.phone,
        vehicle_description = excluded.vehicle_description,
        section_scope       = excluded.section_scope,
        is_active           = true;

  -- The password only travels back when this function invented it. Repeating
  -- one the caller already typed would put it in a response for no reason.
  return jsonb_build_object(
    'id', v_id,
    'email', v_email,
    'password', case when v_made then v_password else null end
  );
end;
$$;

revoke all on function public.admin_create_account(
  text, text, public.user_role, text, public.section_scope, text, text
) from public;

grant execute on function public.admin_create_account(
  text, text, public.user_role, text, public.section_scope, text, text
) to authenticated;

-- ===========================================================================
-- Minimal stand-ins for the parts of a Supabase project the schema depends on
-- (`auth.users`, `auth.uid()`, the `authenticated` role, the realtime
-- publication). Only used by ./run.sh so the test suite can run against a
-- throwaway Postgres with no Docker and no Supabase CLI.
--
-- This file is NEVER applied to a real project — Supabase provides all of it.
-- ===========================================================================
do $harness$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
end $harness$;
grant anon, authenticated, service_role to postgres;
create schema if not exists extensions;
create schema if not exists auth;
create table auth.users (
  instance_id uuid, id uuid primary key, aud varchar(255), role varchar(255),
  email varchar(255) unique, encrypted_password varchar(255), email_confirmed_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
  confirmation_token varchar(255), recovery_token varchar(255),
  email_change_token_new varchar(255), email_change varchar(255));
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users(id) on delete cascade,
  provider_id text, identity_data jsonb, provider text, last_sign_in_at timestamptz,
  created_at timestamptz, updated_at timestamptz, unique (provider_id, provider));
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create publication supabase_realtime;
grant usage on schema public, extensions, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

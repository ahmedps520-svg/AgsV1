-- ===========================================================================
-- AGS Dismissal — core schema
-- ---------------------------------------------------------------------------
-- Multi-tenant by `school_id`. Every table that holds school data carries the
-- school id so Row Level Security can be expressed as a single, cheap check.
-- ===========================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('admin', 'staff', 'parent', 'display');

-- The dismissal lifecycle. `requested` is created by a parent tapping
-- "I'm Here"; `waiting` is the same student acknowledged into the queue (staff
-- may also add students straight to `waiting`).
create type public.dismissal_status as enum (
  'requested',
  'waiting',
  'called',
  'ready',
  'picked_up',
  'cancelled'
);

create type public.request_source as enum ('parent_app', 'staff', 'kiosk');

-- ---------------------------------------------------------------------------
-- Schools
-- ---------------------------------------------------------------------------

create table public.schools (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(trim(name)) > 0),
  slug                text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  logo_url            text,
  timezone            text not null default 'UTC',
  dismissal_start     time,
  dismissal_end       time,
  -- Feature switches a school administrator can flip in Settings.
  show_queue_position boolean not null default true,
  show_pickup_number  boolean not null default true,
  allow_parent_cancel boolean not null default true,
  board_message       text,
  board_accent        text not null default 'indigo',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  school_id           uuid references public.schools (id) on delete set null,
  role                public.user_role not null default 'parent',
  full_name           text not null default '',
  email               text,
  phone               text,
  vehicle_description text,
  avatar_url          text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index profiles_school_role_idx on public.profiles (school_id, role);

-- ---------------------------------------------------------------------------
-- Classrooms
-- ---------------------------------------------------------------------------

create table public.classrooms (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  grade       text not null default '',
  room_number text,
  teacher_id  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (school_id, name)
);

create index classrooms_school_idx on public.classrooms (school_id);

-- ---------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------

create table public.students (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools (id) on delete cascade,
  first_name    text not null check (length(trim(first_name)) > 0),
  last_name     text not null default '',
  grade         text not null default '',
  classroom_id  uuid references public.classrooms (id) on delete set null,
  pickup_number text,
  photo_url     text,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index students_school_idx on public.students (school_id);
create index students_classroom_idx on public.students (classroom_id);
-- Deliberately not unique: siblings normally share one family pickup number.
create index students_pickup_number_idx
  on public.students (school_id, pickup_number)
  where pickup_number is not null and pickup_number <> '';

-- ---------------------------------------------------------------------------
-- Guardians — the pickup-permission table.
-- A parent/driver may only ever see (and request) students they are linked to.
-- ---------------------------------------------------------------------------

create table public.guardians (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students (id) on delete cascade,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  relationship text not null default 'Guardian',
  is_primary   boolean not null default false,
  can_pickup   boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (student_id, profile_id)
);

create index guardians_profile_idx on public.guardians (profile_id);
create index guardians_student_idx on public.guardians (student_id);

-- ---------------------------------------------------------------------------
-- Dismissal requests — the live queue.
--
-- Student details are snapshotted onto the row on insert. The display board is
-- then a single-table read (no joins, no extra RLS surface) and history stays
-- accurate even if a student is later renamed or moves classroom.
-- ---------------------------------------------------------------------------

create table public.dismissal_requests (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools (id) on delete cascade,
  student_id          uuid not null references public.students (id) on delete cascade,
  status              public.dismissal_status not null default 'requested',
  source              public.request_source not null default 'staff',

  requested_by        uuid references public.profiles (id) on delete set null,
  called_by           uuid references public.profiles (id) on delete set null,
  released_by         uuid references public.profiles (id) on delete set null,

  requested_at        timestamptz not null default now(),
  called_at           timestamptz,
  ready_at            timestamptz,
  picked_up_at        timestamptz,
  cancelled_at        timestamptz,

  cancel_reason       text,
  vehicle_description text,
  note                text,
  dismissal_date      date not null default current_date,

  -- Denormalised snapshots (maintained by trigger).
  student_name        text not null default '',
  student_grade       text,
  classroom_name      text,
  pickup_number       text,
  guardian_name       text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index dismissal_requests_board_idx
  on public.dismissal_requests (school_id, dismissal_date, status);
create index dismissal_requests_student_idx
  on public.dismissal_requests (student_id, requested_at desc);
create index dismissal_requests_requester_idx
  on public.dismissal_requests (requested_by, requested_at desc);
create index dismissal_requests_called_idx
  on public.dismissal_requests (school_id, called_at desc);

-- A student can only be in the live queue once at a time.
create unique index dismissal_requests_one_active_per_student_idx
  on public.dismissal_requests (student_id)
  where status in ('requested', 'waiting', 'called', 'ready');

-- ---------------------------------------------------------------------------
-- Audit trail — every status transition, who made it and when.
-- ---------------------------------------------------------------------------

create table public.dismissal_events (
  id          bigint generated always as identity primary key,
  request_id  uuid not null references public.dismissal_requests (id) on delete cascade,
  school_id   uuid not null references public.schools (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_name  text,
  from_status public.dismissal_status,
  to_status   public.dismissal_status not null,
  created_at  timestamptz not null default now()
);

create index dismissal_events_request_idx on public.dismissal_events (request_id, created_at);
create index dismissal_events_school_idx on public.dismissal_events (school_id, created_at desc);

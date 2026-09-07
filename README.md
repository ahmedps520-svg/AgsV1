# AGS Dismissal

Real-time dismissal for **Advanced Generations International Schools** —
مدارس الأجيال المتطورة العالمية.

A parent calls their child from the pickup line. The name turns **yellow** on
that class's board. The teacher taps once when the student leaves and it turns
**grey**. No radios, no shouting down the corridor.

```
Parent taps "I'm here"  →  the class board turns the name yellow
                        →  teacher taps Dismiss  →  the name turns grey
```

Every arrow is a Postgres change streamed over Supabase Realtime — not a poll,
and not a demo that only updates the tab you are looking at.

## How AGS is set up

- **Every class has its own board.** There is no shared school-wide queue.
- **Three roles: administrator, teacher, parent.** A teacher signs in and has
  full use of any class board — there is no separate read-only screen account.
  A driver is a parent-role account linked to a student; whether they are the
  mother, father or a driver is the *relationship* on that link, not a role.
- **Parents do the calling.** Staff can call manually as a fallback when a
  guardian arrives without the app.
- **Class codes:** `7b1` is Grade 7, boys, section 1. `7g1` is the girls'
  section. Kindergarten is mixed and lettered: `KG2-A`.
- **Grades:** KG1–KG3 (mixed), Grades 1–12 (boys and girls in separate sections).
- **Bilingual.** English and Arabic, switchable per device, with full RTL. Times
  and dates follow the language; Asia/Riyadh drives every clock.

Signing in takes a teacher straight to their homeroom board, or to a picker:
grade → boys/girls → section.

> The parent-facing app at `/parent` is a **preview** of what a parent's call
> does. The real parent app is a separate project.

## Live site

Published to GitHub Pages at **<https://ahmedps520-svg.github.io/AgsV1/>**.

> The folders `_next/`, `icons/`, the route folders (`board/`, `students/`, …)
> and `index.html` at the root of this branch are the **published site**, not
> source. Pages serves the root of `main`, and the deploy workflow regenerates
> them on every push — never edit them by hand, and never run
> `scripts/publish-to-root.mjs` yourself. `.published` lists them.

With no Supabase project configured the site runs in **demo mode**: a complete
school (KG1–Grade 12, both sections, ~700 students) lives in the visitor's
browser, and each browser tab keeps its own sign-in — so open a teacher in one
tab and a parent in another and watch a call move the board.

Demo accounts (no password needed — tap one on the sign-in screen):

| Email | Role | What it shows |
| --- | --- | --- |
| `admin@ags.demo` | Administrator | Classes, students, people, settings |
| `teacher@ags.demo` | Teacher | Opens 7b1 |
| `teacher.girls@ags.demo` | Teacher | Opens 5g1 |
| `parent@ags.demo` | Parent | Ahmed (7b1), Salman (3b1), Noura (5g1) |

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the Pages setting and for connecting a
real Supabase project.

## What's in the box

| Surface | Route | Who | What it does |
| --- | --- | --- | --- |
| **Class picker** | `/board` | Teachers, admins | Grade → boys/girls → section; your own classes pinned on top |
| **Class board** | `/board?c=7b1` | Teachers, admins | Every name as a tile: yellow when called, grey when dismissed. One tap to dismiss, one to undo, one to call manually. Fullscreen and an optional chime |
| **Parent preview** | `/parent` | Parents, drivers | Their children only, a big **I'm here**, live status, cancel |
| **Students** | `/students` | Staff (read), admin (edit) | Roster, class assignment, pickup permissions |
| **Classes** | `/classrooms` | Staff (read), admin (edit) | Class codes, rooms, homeroom teachers |
| **People** | `/people` | Admin | Accounts for administrators, teachers and parents |
| **History** | `/history` | Staff | Every call and dismissal with exact times, CSV export |
| **Settings** | `/settings` | Admin | School name, timezone, parent-cancel rule, board message |
| **Account** | `/account` | Everyone | Own details, vehicle, password, language |

## Stack

- **Next.js 16** static export (App Router, React 19) — published to GitHub Pages
- **TypeScript** in strict mode
- **Tailwind CSS v4** with the AGS crest palette (navy `#1E3A73`, gold `#F5B324`)
- **Supabase** — Postgres, Auth, Row Level Security and Realtime
- **Framer Motion** for the board and queue animations
- **PWA** — installable parent app with an offline shell

---

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000 in demo mode
```

To develop against a real database:

```bash
cp .env.example .env.local     # fill in the two Supabase values
npx supabase start             # local Postgres + Auth + Realtime
npx supabase db reset          # applies migrations, then supabase/seed.sql
npm run dev
```

## How it works

### Database

```
schools ──┬── profiles (1:1 with auth.users, carries the role)
          ├── classrooms
          └── students ──┬── guardians        (the pickup-permission table)
                         └── dismissal_requests ── dismissal_events (audit trail)
```

`dismissal_requests` snapshots the student's name, grade, class and pickup number at
creation, so the board is a single-table read and history stays truthful after a student
changes class. The `dismissal_queue` view adds each request's live `queue_position`.

### The lifecycle

```
(nothing)  ──parent taps "I'm here"──▶  called  ──teacher taps Dismiss──▶  picked_up
                                          │                                    │
                                          └──────── cancelled ◀────────────────┘
                                             (parent, before dismissal)
```

A parent's call **is** the call: `request_dismissal()` creates the row already
in `called`, with `called_at` set, so the tile turns yellow immediately. The
teacher moves it to `picked_up`, and undo puts it back — keeping the parent's
original call time and attribution either way.

`staff_call_student()` is the fallback for a guardian who arrived without the
app; it records the teacher as the caller.

A partial unique index guarantees **one active call per student**, so a parent
tapping twice, or a teacher calling an already-called student, is a no-op
rather than a duplicate.

### Security

The site is static, so there is no application server between the browser and the
database. That is safe because the security lives *in* the database:

- **Row Level Security** is on for every table. A parent can read only students they are
  a linked guardian of. Staff read only their own school. A display account can read the
  queue and nothing else.
- `dismissal_requests` has **no** insert/update/delete policy at all. Every mutation goes
  through a `SECURITY DEFINER` function that re-checks the caller's role and ownership.
  A stolen browser token cannot skip a step or call another school's student.
- The anon key in the bundle is designed to be public. **No service-role key is ever built
  in** — which is why account creation happens in the Supabase dashboard rather than in
  the app.
- A strict Content Security Policy is delivered as a meta tag (GitHub Pages cannot send
  headers): scripts and styles only from this origin, network only to Supabase.
- The client-side route guards are navigation, not enforcement — bypassing one shows an
  empty shell, because RLS returns nothing to a caller who isn't entitled to it.

### Real time

Each surface subscribes to `postgres_changes` filtered to its school and treats events as
*invalidations*: it re-reads the `dismissal_queue` view through the same RLS policies. That
keeps derived fields correct, coalesces bursts, and means a live update can never reveal
more than the user may see. Reconnect catch-up, visibility refresh and a slow poll keep an
unattended wall display honest. In demo mode the same hook listens to a `BroadcastChannel`
instead.

---

## Testing

```bash
npm run test:db    # 36 assertions against a throwaway Postgres with RLS enforced
npm run lint       # ESLint + the React Compiler rules
npm run typecheck  # tsc --noEmit
npm run build      # static export into ./out
```

`test:db` covers the state machine, timestamp clearing on undo, the audit trail, parent
isolation, display read-only access, the parent-cancel setting and cross-school isolation.
It needs a local PostgreSQL install and must not be run as root.

---

## Project layout

```
src/
  app/              routes (all client-rendered; static export)
  components/       ui primitives, dismissal, board, parent, admin, auth
  hooks/            useLiveQueue (realtime / demo), useNow, useClientFlag
  lib/api/          session, queries, mutations, demo store, change bus
  lib/brand.ts      AGS name, Arabic name and crest colours
  lib/supabase/     browser client
supabase/
  migrations/       schema · security + RLS · workflow functions
  seed.sql          demo school (local Supabase only)
  tests/            data-layer test suite + throwaway-cluster runner
.github/workflows/  build + deploy to GitHub Pages
scripts/            icon generation from the crest, service-worker prep
```

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## Licence

MIT.

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
  full use of any class board in their section — there is no separate read-only
  screen account. A driver is a parent-role account linked to a student; whether
  they are the mother, father or a driver is the *relationship* on that link,
  not a role.
- **One shared teacher login per building.** Boys, girls and kindergarten each
  have their own; the account only ever sees its own half of the school.
- **Only what has happened shows on a board.** Called in yellow, gone in grey,
  and a count of everyone still in class. Nobody reads thirty names to find two.
- **Parents do the calling.** Staff can call manually as a fallback when a
  guardian arrives without the app.
- **Class codes:** `7b1` is Grade 7, boys, section 1. `7g1` is the girls'
  section. Kindergarten is mixed and lettered: `KG2-A`.
- **Grades:** KG1–KG3 (mixed), Grades 1–12 (boys and girls in separate sections).
- **Bilingual.** English and Arabic, switchable per device, with full RTL. Times
  and dates follow the language; Asia/Riyadh drives every clock.

Signing in leads to a picker: grade → section (and boys or girls, when the
account can reach both). Classes the account cannot open are never offered.

## Live site

Published to GitHub Pages at **<https://ahmedps520-svg.github.io/AgsV1/>**.

> The folders `_next/`, `icons/`, the route folders (`board/`, `students/`, …)
> and `index.html` at the root of this branch are the **published site**, not
> source. Pages serves the root of `main`, and the deploy workflow regenerates
> them on every push — never edit them by hand, and never run
> `scripts/publish-to-root.mjs` yourself. `.published` lists them.

Until the two Supabase values are set as repository *variables*, the published site
builds without a database and the sign-in screen says so. There is no demo mode
and no offline fake: every name on a board came out of Postgres.

## Who signs in

One shared login per building, because that is how the school works — every
teacher on the boys' side types the same email and password, then picks their
own class.

| Email | Sees |
| --- | --- |
| `dismissal.boys@ags.edu.sa` | Every boys' class, Grades 1–12 |
| `dismissal.girls@ags.edu.sa` | Every girls' class, Grades 1–12 |
| `dismissal.kg@ags.edu.sa` | KG1–KG3 |
| `admin@ags.edu.sa` | Everything, plus students, people and settings |

Sharing a password is only safe because the confinement is in the database, not
in the interface. `profiles.section_scope` is checked by Row Level Security on
classes, students *and* calls, so the boys' password — passed around a staff
room, typed on a shared tablet, eventually leaked — still cannot read a girls'
class or call a girls' student. The class picker follows suit: an account that
can never open a girls' class is not offered the button.

Parents get their own accounts, one per guardian, linked to their children.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the Pages setting and for connecting a
real Supabase project.

## What's in the box

| Surface | Route | Who | What it does |
| --- | --- | --- | --- |
| **Class picker** | `/board` | Teachers, admins | Grade → boys/girls → section; your own classes pinned on top |
| **Class board** | `/board?c=7b1` | Teachers, admins | Only the names something has happened to: yellow when called, grey when dismissed, and a count of everyone still sitting in class. One tap to dismiss, one to undo, one to call manually. Fullscreen and an optional chime |
| **Parent app** | `/parent` | Parents, drivers | Their children only, a big **I'm here**, live status, cancel |
| **Students** | `/students` | Staff (read), admin (edit) | Roster, class assignment, pickup permissions, and the end-of-year promotion |
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
cp .env.example .env.local     # fill in the two Supabase values
npx supabase start             # local Postgres + Auth + Realtime
npx supabase db reset          # applies migrations, then supabase/seed.sql
npm run dev                    # http://localhost:3000
```

`supabase/seed.sql` is for local development only — it creates a small school
with well-known passwords.

A real project is set up with two pastes into the Supabase SQL editor, so it
can be done without a computer: `supabase/install.sql` (every migration in one
file, generated by `npm run db:install-sql`, nothing to edit) and then
`supabase/setup.sql` (the school, all 54 classes and the four staff logins;
four values to edit at the top). See [DEPLOYMENT.md](./DEPLOYMENT.md).

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
  a linked guardian of. Staff read only their own school — and only the section their
  account is scoped to, which is what makes one password per building safe.
- `dismissal_requests` has **no** insert/update/delete policy at all. Every mutation goes
  through a `SECURITY DEFINER` function that re-checks the caller's role, section and
  ownership. A stolen browser token cannot skip a step or call another school's student.
- The anon key in the bundle is designed to be public. **No service-role key is ever built
  in.** Creating a login needs that key, so it happens in the `create-account` Edge
  Function, which verifies for itself that the caller is an active administrator before
  the privileged client is ever constructed.
- A strict Content Security Policy is delivered as a meta tag (GitHub Pages cannot send
  headers): scripts and styles only from this origin, network only to **this project's**
  Supabase host — not to `*.supabase.co`, so a stolen script cannot phone home to
  somebody else's project.
- The client-side route guards are navigation, not enforcement — bypassing one shows an
  empty shell, because RLS returns nothing to a caller who isn't entitled to it.

### Real time

Each surface subscribes to `postgres_changes` filtered to its school and treats events as
*invalidations*: it re-reads the `dismissal_queue` view through the same RLS policies. That
keeps derived fields correct, coalesces bursts, and means a live update can never reveal
more than the user may see. Reconnect catch-up, visibility refresh and a slow poll keep an
unattended wall display honest.

---

## Testing

```bash
npm run test:db    # 24 groups against a throwaway Postgres with RLS enforced
npm run lint       # ESLint + the React Compiler rules
npm run typecheck  # tsc --noEmit
npm run build      # static export into ./out
```

`test:db` covers the state machine, timestamp clearing on undo, the audit trail, parent
isolation, the parent-cancel setting, cross-school isolation, section confinement (a
boys' account cannot read or call anything on the girls' side) and end-of-year promotion.
It needs a local PostgreSQL install and must not be run as root.

---

## Project layout

```
src/
  app/              routes (all client-rendered; static export)
  components/       ui primitives, dismissal, board, parent, admin, auth
  hooks/            useLiveQueue (realtime), useNow, useClientFlag
  lib/api/          session, queries, mutations
  lib/brand.ts      AGS name, Arabic name and crest colours
  lib/supabase/     browser client
supabase/
  migrations/       schema · security + RLS · workflow · classes · roles · scopes
  install.sql       all the migrations in one file, for the SQL editor (generated)
  setup.sql         one-time project bootstrap: school, classes, staff logins
  seed.sql          small development school (local Supabase only)
  functions/        create-account Edge Function (the only service-role caller)
  tests/            data-layer test suite + throwaway-cluster runner
.github/workflows/  build + deploy to GitHub Pages
scripts/            icon generation from the crest, service-worker prep
```

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## Licence

MIT.

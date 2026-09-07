# Map Dismissals

Real-time school dismissal for staff, families and the screen in the hallway.

Parents tap **I'm Here** from the pickup line, staff work a single live queue, and the
dismissal board updates the instant a student is called. No refreshing, no radios, no
clipboard.

```
Parent taps "I'm Here"  →  Staff dashboard  →  Dismissal board  →  Parent's status card
        (request)              (call)             (now dismissing)      (called / ready)
```

Every arrow above is a Postgres change streamed over Supabase Realtime — not a poll, and
not a demo that only updates the tab you're looking at.

---

## What's in the box

| Surface | Route | Who | What it does |
| --- | --- | --- | --- |
| **Staff dashboard** | `/dashboard` | Teachers, admins | Live queue in four lanes (Arrived → Called → Ready → Picked up), search by name/grade/class/pickup number, Call Next, one-tap status changes, undo, cancel, end-of-day close-out |
| **Dismissal board** | `/board` | Hallway TV, projector | Fullscreen "NOW DISMISSING" hero, animated name entry, recently called, ready list, live clock, queue counts, optional chime |
| **Parent app** | `/parent` | Parents, authorised drivers | Their students only, a big **I'm Here** button, live status tracker (Request Sent → Waiting → Called → Ready → Picked Up), queue position, cancel |
| **Students** | `/students` | Staff (read), admin (edit) | Roster, classes, pickup numbers, and who may collect each student |
| **Classes** | `/classrooms` | Staff (read), admin (edit) | Grades, rooms, homeroom teachers |
| **People** | `/people` | Admin | Create logins for staff, parents, drivers and display screens |
| **History** | `/history` | Staff | Every dismissal for a chosen day, with exact timestamps and CSV export |
| **Settings** | `/settings` | Admin | Timezone, dismissal window, queue-position visibility, pickup numbers, parent cancellation, board message |
| **Account** | `/account` | Everyone | Own details, vehicle description, password |

---

## Stack

- **Next.js 16** (App Router, Server Actions, React 19)
- **TypeScript** in strict mode
- **Tailwind CSS v4** with a token-driven design system
- **Supabase** — Postgres, Auth, Row Level Security and Realtime
- **Framer Motion** for the board and queue animations
- **PWA** — installable parent app with an offline shell

---

## Getting started

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Create the database

**Option A — Supabase cloud (what you'll deploy against)**

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Copy **Project URL** and the **anon** key from *Project Settings → API* into `.env.local`.
3. Push the schema:

   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

4. In *Authentication → Providers*, turn **off** "Allow new users to sign up".
   Accounts are created by school administrators, never self-service.

**Option B — fully local**

```bash
npx supabase start     # Postgres + Auth + Realtime in Docker
npx supabase db reset  # applies migrations, then supabase/seed.sql
```

`supabase status` prints the local URL and anon key for `.env.local`.

### 3. Run it

```bash
npm run dev
```

Open <http://localhost:3000>.

### Demo accounts

`supabase/seed.sql` (local only) creates a school with ten students and these logins —
all with the password `Dismissal123!`:

| Email | Role | Try this |
| --- | --- | --- |
| `admin@mapdismissals.demo` | Administrator | Manage the roster, accounts and settings |
| `teacher@mapdismissals.demo` | Staff | Run the queue at `/dashboard` |
| `board@mapdismissals.demo` | Display | Open `/board` on a second screen |
| `parent@mapdismissals.demo` | Parent | Tap **I'm Here** for Ahmed and Salman AlShehri |
| `driver@mapdismissals.demo` | Driver | The same two students, via a different account |

**The two-window demo:** sign in as the teacher in one window and the parent in another
(use a private window for the second). Tap **I'm Here** as the parent and watch the
request land on the dashboard; press **Call next** and watch the parent's tracker and the
board move — with no refresh anywhere.

---

## Your first real school

1. Sign in as an administrator.
2. **Settings** — set the school name and timezone. The timezone drives every clock and
   decides which day a dismissal belongs to.
3. **Classes** — add your classes (`7B`, `Grade 7`, room `B-204`).
4. **Students** — add the roster. Pickup numbers are optional and siblings may share one.
5. **People** — create accounts. Each one gets either an emailed invitation or a
   temporary password you can hand over at the office.
6. **Students → Edit → Who may pick up** — link each parent or driver to their students.
   *This is the permission that matters:* a parent can only ever see, and request, a
   student they are linked to.
7. Open `/board` on the hallway screen (sign in once with a `display` account, then press
   **Fullscreen**).

---

## How it works

### Database

Five tables carry the domain, plus an audit log:

```
schools ──┬── profiles (1:1 with auth.users, carries the role)
          ├── classrooms
          └── students ──┬── guardians        (the pickup-permission table)
                         └── dismissal_requests ── dismissal_events (audit trail)
```

`dismissal_requests` snapshots the student's name, grade, class and pickup number at
creation time. The board is therefore a single-table read with no joins, and history stays
truthful even after a student changes class.

The `dismissal_queue` view adds each request's live `queue_position` and `queue_length`.

### The state machine

```
requested ──▶ waiting ──▶ called ──▶ ready ──▶ picked_up
    │            │           │          │
    └────────────┴───────────┴──────────┴──▶ cancelled
```

`requested` is created by a parent tapping **I'm Here**; staff may add a student straight
to `waiting`. Staff can move a request backwards to undo a mistake, and doing so clears
the timestamps that no longer apply, so the board never shows a stale "Called at …".

A partial unique index guarantees **one active request per student**, so a parent tapping
twice, or a teacher adding a student who is already queued, is a no-op rather than a
duplicate.

### Security

Row Level Security is on for every table, and the policies are the real access control —
not a convenience layer on top of it:

- A **parent** can read only students they are a linked guardian of, and only dismissal
  requests for those students. They cannot read another family's data, other profiles, or
  the roster.
- **Staff** read everything inside their own school, and nothing outside it.
- **Admins** additionally manage the roster, accounts and settings.
- A **display** account can read the queue and nothing else — a screen in a public
  hallway can't be used to browse students.

`dismissal_requests` has **no** insert/update/delete policy at all. Every mutation goes
through a `SECURITY DEFINER` function (`request_dismissal`, `call_next_student`,
`set_request_status`, `cancel_request`, `end_dismissal_session`) that re-checks the
caller's role and ownership. A stolen browser token cannot skip a step or call another
school's student.

The service-role key is used for exactly one thing — provisioning login accounts on behalf
of a verified administrator — and lives only in `src/lib/supabase/admin.ts`, which is
`server-only`.

### Real time

Each surface subscribes to `postgres_changes` on `dismissal_requests`, filtered to its own
school. Change events are treated as *invalidations*: the client re-reads
`dismissal_queue` through the same RLS policies as the server render. That keeps derived
fields correct, coalesces bursts (calling ten students costs one refetch), and means a
live update can never show more than the user is allowed to see.

Three fallbacks keep a wall-mounted screen honest: a catch-up read on every reconnect, a
refresh when the tab becomes visible again, and a slow poll (20–30 s) in case a websocket
dies silently. The connection state is always visible as a **Live / Reconnecting** pill.

---

## Testing the data layer

The security model is only as good as its policies, so they're tested as a real Postgres
role with RLS enforced — 34 assertions covering the state machine, the audit trail, parent
isolation, display read-only access, and cross-school isolation.

```bash
npm run test:db
```

This spins up a throwaway PostgreSQL cluster, applies `supabase/migrations` and the seed,
and runs `supabase/tests/data-layer.test.sql`. It needs a local PostgreSQL install and
must not be run as root. Against a running `supabase start` you can instead do:

```bash
psql "$(npx supabase status -o json | jq -r .DB_URL)" -f supabase/tests/data-layer.test.sql
```

Other checks:

```bash
npm run lint       # ESLint + the React Compiler rules
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

---

## Project layout

```
src/
  app/
    (app)/            staff + admin shell (sidebar): dashboard, students,
                      classrooms, people, history, settings
    board/            fullscreen dismissal board
    parent/           mobile-first parent PWA
    login/  account/  auth/    sign-in, self-service account, callback + sign-out
  components/
    ui/               buttons, fields, modal/sheet, toasts, primitives
    dismissal/        queue cards, lanes, add-to-queue, stat tiles
    board/            board client, clock, chime
    parent/           status tracker, arrival sheet, install hint
    admin/            roster, classes, people, history, settings
  hooks/              useLiveQueue (realtime), useNow, useClientFlag
  lib/                supabase clients, design tokens, domain model, utils
  server/             session guards, queries, server actions
  proxy.ts            session refresh + auth gate (Next 16's middleware)
supabase/
  migrations/         schema · security + RLS · workflow functions
  seed.sql            demo school, students and logins (local only)
  tests/              data-layer test suite + throwaway-cluster runner
```

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for Vercel, Render, environment variables, the
PWA checklist and going-live steps.

## Licence

MIT.

# AGS Dismissals

Real-time school dismissal for **Advanced Generations International Schools** —
مدارس الأجيال المتطورة العالمية.

Parents tap **I'm Here** from the pickup line, staff work a single live queue, and the
board in the lobby updates the instant a student is called. No refreshing, no radios, no
clipboard.

**Live site:** <https://ahmedps520-svg.github.io/AgsV1/>

```
Parent taps "I'm Here"  →  Staff dashboard  →  Dismissal board  →  Parent's status card
        (request)              (call)             (now dismissing)      (called / ready)
```

---

## Two ways to run it

The same static bundle runs in one of two modes, decided at build time:

| Mode | When | What happens |
| --- | --- | --- |
| **Demo** | No Supabase variables set (the published site today) | A complete school lives in the visitor's browser. Every tab keeps its own sign-in, so you can be a teacher in one tab, a parent in another and the lobby board in a third — and watch them stay in step. Nothing leaves the device. |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set | A real school. Every read and write goes to Postgres, where Row Level Security and the workflow functions enforce the rules. Realtime streams changes to every connected device. |

Switching the published site to a real school is two repository variables — see
[DEPLOYMENT.md](./DEPLOYMENT.md).

---

## What's in the box

| Surface | Route | Who | What it does |
| --- | --- | --- | --- |
| **Staff dashboard** | `/dashboard` | Teachers, admins | Live queue in four lanes (Arrived → Called → Ready → Picked up), search by name/grade/class/pickup number, Call Next, one-tap status changes, undo, cancel, restore, end-of-day close-out |
| **Dismissal board** | `/board` | Lobby TV, projector | Fullscreen "NOW DISMISSING" hero, animated name entry, recently called, ready list, live clock, queue counts, optional chime |
| **Parent app** | `/parent` | Parents, authorised drivers | Their students only, a big **I'm Here** button, live status tracker (Request Sent → Waiting → Called → Ready → Picked Up), queue position, cancel |
| **Students** | `/students` | Staff (read), admin (edit) | Roster, classes, pickup numbers, and who is allowed to collect each student |
| **Classes** | `/classrooms` | Staff (read), admin (edit) | Grades, rooms, homeroom teachers |
| **People** | `/people` | Admin | Staff, parents, drivers and display accounts |
| **History** | `/history` | Staff | Every dismissal for a chosen day, with exact timestamps and CSV export |
| **Settings** | `/settings` | Admin | Timezone, dismissal window, queue-position visibility, pickup numbers, parent cancellation, board message |
| **Account** | `/account` | Everyone | Own details, vehicle description, password |

---

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

### Demo accounts

The demo (and `supabase/seed.sql`) ship with a school, ten students and these logins.
In demo mode just click the account on the sign-in page; against local Supabase the
password is `Dismissal123!`.

| Email | Role | Try this |
| --- | --- | --- |
| `admin@ags.demo` | Administrator | Manage the roster, accounts and settings |
| `teacher@ags.demo` | Staff | Run the queue at `/dashboard` |
| `board@ags.demo` | Display | Open `/board` on a second screen |
| `parent@ags.demo` | Parent | Tap **I'm Here** for Ahmed and Salman AlShehri |
| `driver@ags.demo` | Driver | The same two students, via a different account |

**The three-tab demo:** sign in as the teacher in one tab, the parent in a second, the
display in a third. Tap **I'm Here** as the parent and watch the request land on the
dashboard; press **Call next** and watch the board and the parent's tracker move.

---

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

### The state machine

```
requested ──▶ waiting ──▶ called ──▶ ready ──▶ picked_up
    │            │           │          │
    └────────────┴───────────┴──────────┴──▶ cancelled
```

Staff can move a request backwards to undo a mistake; doing so clears the timestamps that
no longer apply. A partial unique index guarantees **one active request per student**, so
a double tap is a no-op rather than a duplicate.

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

## Live site

Published to GitHub Pages at **<https://ahmedps520-svg.github.io/AgsV1/>**.

With no Supabase project configured the site runs in **demo mode**: a complete
school lives in the visitor's browser, and each browser tab keeps its own
sign-in — so open the teacher in one tab, a parent in another and the lobby
board in a third, and watch a call move all three at once.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the one-time Pages source setting and
for connecting a real Supabase project.

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## Licence

MIT.

# Deploying AGS Dismissal

The app is a static export published to **GitHub Pages** by
`.github/workflows/deploy-pages.yml`. Every push to `main` rebuilds and redeploys.

Live site: <https://ahmedps520-svg.github.io/AgsV1/>

---

## 0. One-time: choose how Pages serves the site

Open **Settings → Pages → Build and deployment → Source** and pick either:

| Source | Then set | What happens |
| --- | --- | --- |
| **Deploy from a branch** | branch **`main`**, folder **`/ (root)`** *(the current setting)* | The build job commits the export to the root of `main` and GitHub serves it as-is. |
| **GitHub Actions** | nothing else | The `deploy` job in `.github/workflows/deploy-pages.yml` publishes each build. |
| **Deploy from a branch** | branch **`gh-pages`**, folder **`/ (root)`** | Every run force-pushes the built site to `gh-pages`. |

The workflow handles all three, so it stays green whichever you pick.

> With **main / (root)**, `.nojekyll` at the root is what stops GitHub's Jekyll
> builder from publishing the README instead of the app. Do not delete it, and
> never run `scripts/publish-to-root.mjs` by hand — only CI should.

The site then appears at <https://ahmedps520-svg.github.io/AgsV1/>.

While you are in the settings, set **Settings → General → Default branch** to
`main` so pull requests and clones start from the right place.

## 1. The site before a database is connected

With no Supabase variables configured, the workflow still builds and publishes
the site, but the sign-in screen says the school's database has not been
connected yet. There is no demo mode: nothing in this app pretends to work.

Push to `main`, wait for the "Deploy to GitHub Pages" workflow, and the site
updates. Step 2 is what makes it usable.

> **HTTPS.** GitHub Pages serves `github.io` sites over HTTPS. In
> *Settings → Pages*, make sure **Enforce HTTPS** is ticked so plain-HTTP requests are
> redirected — the app's session cookies and service worker require it.

---

## 2. Connecting a real school

### a. Create the Supabase project

1. New project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Apply the schema:

   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

3. **Authentication → Providers → Email:** turn **off** "Allow new users to sign up".
   Accounts are issued by the school, never self-service.
4. **Authentication → URL Configuration:**
   - Site URL: `https://ahmedps520-svg.github.io/AgsV1/`
   - Redirect URLs: add `https://ahmedps520-svg.github.io/AgsV1/auth/callback/`
5. **Database → Replication:** confirm `dismissal_requests` is in the `supabase_realtime`
   publication (the migration adds it — this is a sanity check).

### b. Create the school, the classes and the staff logins

Open `supabase/setup.sql`, change the four values in the `settings` block at the
top — above all `v_admin_pw` — then paste the whole file into the Supabase **SQL
editor** and run it. It creates:

- the school record
- every class: KG1–KG3 lettered and mixed, Grades 1–12 split boys / girls
- the four logins the school signs in with

It is safe to run twice; nothing is duplicated.

| Email | Role | Sees |
| --- | --- | --- |
| `admin@ags.edu.sa` | Administrator | Everything |
| `dismissal.boys@ags.edu.sa` | Teacher | Boys' classes only |
| `dismissal.girls@ags.edu.sa` | Teacher | Girls' classes only |
| `dismissal.kg@ags.edu.sa` | Teacher | Kindergarten only |

One shared password per building is how the school works, and it is safe here
because the confinement is enforced by Row Level Security on classes, students
and calls — not by hiding buttons. Change it from **Account** whenever staff
change, and *do* change the administrator's password immediately: that account
can move the whole school up a grade.

### c. Point the site at it

**Settings → Secrets and variables → Actions → Variables** (not Secrets — these are
public by design):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon / publishable key from *Project Settings → API* |

Re-run the workflow (Actions → Deploy to GitHub Pages → Run workflow). The published site
now talks to your database.

> **Never add `SUPABASE_SERVICE_ROLE_KEY`.** A static site is delivered to every visitor's
> browser; there is nowhere to keep a secret. The anon key is fine because every request
> it makes is filtered by Row Level Security.

### d. Add everyone else

Sign in as the administrator and set up **Settings** (timezone first — it drives every
clock), **Classes**, and **Students**.

**Logins** are created from the **People** page, which calls the `create-account`
Edge Function. Deploy it once:

```bash
npx supabase functions deploy create-account
```

It needs no extra configuration — Supabase injects `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` into the function's own
environment. That key is why account creation lives there and not in the app:
a static site is delivered to every visitor, so it can never hold one. The
function re-reads the caller's identity with the caller's own token and refuses
anyone who is not an active administrator of the school being written to.

For a parent or driver, creating the login is only half the job: open
**Students → Edit → Who may pick up** and link them to their children — *that*
is the permission that matters.

Roles are `admin`, `staff` and `parent`. A driver is a `parent` account whose
guardian link says "Authorised driver"; there is no separate driver role, and no
read-only screen account — a teacher login can open any board it is scoped to.

### e. At the end of the school year

**Students → Move everyone up a grade.** Grade 12 leaves, everyone else moves up
one, and kindergarten leavers are placed in a boys' or girls' Grade 1 class by
the gender on their own record. A student with no gender recorded stays where
they are rather than being put in the wrong building — the confirmation dialog
tells you how many that was.

---

## 3. A board on a classroom screen

Sign in on the screen's browser with the building's shared login, pick the class,
and press **Fullscreen**. Controls fade after a few seconds of no input. Turn on
the chime for an audible cue when a name appears. The device remembers the class
it last opened, so a screen that reboots comes back to the same board.

---

## 4. Parents

On `/parent/` they see an "Add to your home screen" prompt (iOS: *Share → Add to Home
Screen*). Installed, **I'm Here** is one tap from the lock screen.

PWA checklist after a deploy:

- [ ] `/AgsV1/manifest.webmanifest` returns JSON with `start_url: "/AgsV1/parent/"`
- [ ] Lighthouse → *Installable* passes on `/AgsV1/parent/`
- [ ] With the network off, a hard refresh shows the offline screen

The service worker caches only the static shell. Supabase traffic is never cached. To ship
a new shell, bump `VERSION` in `public/sw.js`.

---

## 5. Other hosts

The `out/` folder is plain static files; any static host works (Vercel, Netlify,
Cloudflare Pages, Render static sites, an S3 bucket). Build with:

```bash
NEXT_PUBLIC_BASE_PATH= NEXT_PUBLIC_SITE_URL=https://your-domain npm run build
```

Leave `NEXT_PUBLIC_BASE_PATH` empty for a root domain. On a host that can set response
headers, send `Content-Security-Policy: frame-ancestors 'none'` and
`Strict-Transport-Security`; the app already ships the rest of its CSP as a meta tag.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Sign-in says the database isn't connected | Variables not set, or workflow not re-run | Check *Actions → Variables*, then re-run the workflow |
| "Only a school administrator can create accounts" | Signed in as a teacher, or the Edge Function is not deployed | Sign in as the admin; `npx supabase functions deploy create-account` |
| A teacher can't find their class | That account is scoped to the other building | Use the login for their section, or `dismissal.kg@…` for kindergarten |
| "Couldn't load the queue" | Migrations not applied | `npx supabase db push` |
| Pill stuck on **Reconnecting** | `dismissal_requests` not in the realtime publication, or a proxy blocking websockets | Check *Database → Replication*; allow `wss://` to your project host. The board still refreshes on a timer meanwhile |
| Parent sees no students | No guardian links | *Students → Edit → Who may pick up* |
| Invitation / reset email lands on an error | Redirect URL missing | Add `…/AgsV1/auth/callback/` in *Authentication → URL Configuration* |
| Deep link 404s after refresh | Pages served an old build | Wait for the workflow to finish; hard-refresh |

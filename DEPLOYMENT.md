# Deploying AGS Dismissal

The app is a static export published to **GitHub Pages** by
`.github/workflows/deploy-pages.yml`. Every push to `main` rebuilds and redeploys.

Live site: <https://ahmedps520-svg.github.io/AgsV1/>

---

## 0. One-time: choose how Pages serves the site

Open **Settings → Pages → Build and deployment → Source** and pick either:

| Source | Then set | What happens |
| --- | --- | --- |
| **GitHub Actions** *(recommended)* | nothing else | The `deploy` job in `.github/workflows/deploy-pages.yml` publishes each build. |
| **Deploy from a branch** | branch **`gh-pages`**, folder **`/ (root)`** | Every run force-pushes the built site to `gh-pages`, and GitHub serves it. |

> **Do not** point "Deploy from a branch" at **`main`**. That branch holds the
> source, so GitHub's built-in Jekyll builder publishes the README instead of
> the app — which looks like "Pages is on but the site is wrong".

The `gh-pages` branch is created automatically by the first workflow run, so it
is available in the branch dropdown straight away.

The site then appears at <https://ahmedps520-svg.github.io/AgsV1/>.

While you are in the settings, set **Settings → General → Default branch** to
`main` so pull requests and clones start from the right place.

## 1. The site as published — demo mode

With no Supabase variables configured, the workflow builds the **demo**: a full school in
the visitor's browser, with per-tab sign-in so one person can play teacher, parent and
lobby board at once. It is safe to share — nothing is stored anywhere but the visitor's
own device.

Nothing else is needed for this. Push to `main`, wait for the "Deploy to GitHub Pages"
workflow, and the site updates.

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

### b. Create the school and its first administrator

There is no self-service sign-up by design. Run this in the SQL editor:

```sql
insert into public.schools (name, slug, timezone)
values ('Advanced Generations International Schools', 'ags', 'Asia/Riyadh')
returning id;
```

Then **Authentication → Users → Add user**, with *Auto Confirm* on and this user metadata
(paste the id the query returned):

```json
{ "full_name": "Your Name", "role": "admin", "school_id": "<the school id>" }
```

The `handle_new_user` trigger builds the matching profile.

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

**Logins** are created in the Supabase dashboard, because the app cannot hold the key
that creates accounts. For each teacher, parent, driver or display screen:

*Authentication → Users → Add user*, Auto Confirm on, metadata:

```json
{ "full_name": "Fatima AlShehri", "role": "parent", "school_id": "<school id>" }
```

`role` is one of `admin`, `staff`, `parent`, `display`. The person appears on the
**People** page immediately. Then, for parents and drivers, open **Students → Edit → Who
may pick up** and link them — *this is the permission that matters*.

If you later want in-app account creation, add a Supabase Edge Function that calls
`auth.admin.createUser` with the service-role key held server-side, and have the People
form call it. The form and the profile sync are already there.

---

## 3. The hallway screen

Create a `display` account, sign in once on the TV's browser, open `/board/`, and press
**Fullscreen**. Controls fade after a few seconds of no input. Turn on the chime for an
audible cue when a name appears.

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
| Site shows the demo, not my school | Variables not set, or workflow not re-run | Check *Actions → Variables*, then re-run the workflow |
| "Couldn't load the queue" | Migrations not applied | `npx supabase db push` |
| Pill stuck on **Reconnecting** | `dismissal_requests` not in the realtime publication, or a proxy blocking websockets | Check *Database → Replication*; allow `wss://` to `*.supabase.co` |
| Parent sees no students | No guardian links | *Students → Edit → Who may pick up* |
| Invitation / reset email lands on an error | Redirect URL missing | Add `…/AgsV1/auth/callback/` in *Authentication → URL Configuration* |
| Deep link 404s after refresh | Pages served an old build | Wait for the workflow to finish; hard-refresh |

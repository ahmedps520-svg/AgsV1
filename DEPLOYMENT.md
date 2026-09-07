# Deploying Map Dismissals

Map Dismissals is a standard Next.js app plus a Supabase project. Deploy the app anywhere
that runs Node 20+, and point it at your Supabase project.

---

## 1. Environment variables

| Variable | Where it's used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Safe to expose — every request it makes is still filtered by Row Level Security |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Used solely to create login accounts for a verified administrator. Never prefix it with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | server | Your public origin, e.g. `https://dismissals.yourschool.edu`. Used to build invitation and password-reset links |

Find the first three in *Project Settings → API* in the Supabase dashboard.

> If `SUPABASE_SERVICE_ROLE_KEY` is missing the app still runs — administrators just see a
> clear message when they try to create an account, instead of a crash.

---

## 2. Prepare the Supabase project

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Then, in the Supabase dashboard:

1. **Authentication → Providers → Email**
   - Turn **off** "Allow new users to sign up". Accounts are issued by school
     administrators; self-service signup would let anyone create a parent account.
   - Leave "Confirm email" on if you plan to use emailed invitations.

2. **Authentication → URL Configuration**
   - *Site URL*: `https://your-domain`
   - *Redirect URLs*: add `https://your-domain/auth/callback`

3. **Database → Replication** (or *Realtime*)
   - Confirm `dismissal_requests` is in the `supabase_realtime` publication. The migration
     adds it, so this is just a sanity check.

4. **Create the first administrator.** There is no bootstrap screen by design — the first
   account is created by you:

   ```sql
   -- Run in the Supabase SQL editor.
   insert into public.schools (name, slug, timezone)
   values ('Your School', 'your-school', 'Asia/Riyadh')
   returning id;
   ```

   Then *Authentication → Users → Add user*, with **Auto Confirm** on and this user
   metadata (paste the school id you just got back):

   ```json
   {
     "full_name": "Your Name",
     "role": "admin",
     "school_id": "<the school id>"
   }
   ```

   The `handle_new_user` trigger builds the matching profile. Sign in, and create everyone
   else from **People**.

---

## 3. Deploy the app

### Vercel (recommended)

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Framework preset: **Next.js**. Build command and output directory are detected.
3. Add the four environment variables from step 1 to *Production* (and *Preview*, if you
   use preview deployments — point those at a separate Supabase project).
4. Deploy, then add your custom domain and set `NEXT_PUBLIC_SITE_URL` to match.

### Render

Create a **Web Service** from the repository:

- **Runtime:** Node
- **Build command:** `npm ci && npm run build`
- **Start command:** `npm run start`
- **Health check path:** `/login`
- Add the same environment variables.

A `render.yaml` is included, so you can also use Render's Blueprint flow and just fill in
the environment variables it prompts for.

### Anywhere else (Docker, Fly.io, a VPS)

```bash
npm ci
npm run build
npm run start        # serves on $PORT, default 3000
```

Run it behind HTTPS. Secure cookies and the service worker both require it.

---

## 4. After the first deploy

- **Set the timezone** in *Settings*. It drives every clock and decides which calendar day
  a dismissal belongs to — get it right before your first pickup.
- **Set up the hallway screen.** Create a `display` account in *People*, sign in on the TV
  browser once, open `/board`, and press **Fullscreen**. The controls fade out after a few
  seconds of no input. Turn on the chime if you want an audible cue.
- **Tell parents to install the app.** On the `/parent` screen they'll see an "Add to your
  home screen" prompt; on iOS it's *Share → Add to Home Screen*. Installed, **I'm Here** is
  one tap from the lock screen.

---

## PWA checklist

The manifest, icons and service worker are already wired up. After a deploy, confirm:

- [ ] `/manifest.webmanifest` returns JSON with `start_url: "/parent"`
- [ ] `/sw.js` is served with `Cache-Control: public, max-age=0, must-revalidate`
      (set in `next.config.ts`)
- [ ] Lighthouse → *Installable* passes on `/parent`
- [ ] With the network off, a hard refresh shows the offline screen rather than a browser
      error

The worker deliberately caches only the static shell. Supabase traffic is never cached —
dismissal data must always be live, and a cached response could otherwise leak between
accounts on a shared device. To ship a new shell, bump `VERSION` in `public/sw.js`.

To regenerate the icons after changing the mark:

```bash
npm run icons
```

---

## Operating notes

**Scale.** A dismissal window is bursty but small: a 1,000-student school generates on the
order of a few hundred rows an afternoon. The queries are indexed on
`(school_id, dismissal_date, status)`, and clients coalesce refetches, so Supabase's free
tier comfortably covers a single school.

**Multiple schools.** Every table is keyed by `school_id` and the RLS policies enforce it
(there's a test for exactly this). One deployment can serve a whole district.

**End of day.** *End dismissal* on the dashboard cancels anything still open so tomorrow
starts clean. Completed pickups stay in *History*.

**Backups.** Supabase takes daily backups on paid plans. On the free tier, schedule your
own `pg_dump`; `dismissal_events` is your audit trail and worth keeping.

**Monitoring.** Watch the **Live / Reconnecting** pill — it's the fastest signal that
Realtime is unhappy. Even fully disconnected, every surface still refreshes on a timer, so
dismissal degrades rather than stops.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Setup screen instead of the app | Supabase variables missing | Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then redeploy |
| "We couldn't load the queue" | Migrations not applied | `npx supabase db push` |
| Pill stuck on **Reconnecting** | `dismissal_requests` not in the realtime publication, or a proxy blocking websockets | Check *Database → Replication*; allow `wss://` to `*.supabase.co` |
| Parent sees no students | No guardian links | *Students → Edit → Who may pick up* |
| Signed-in users bounce back to `/login` | `NEXT_PUBLIC_SITE_URL` doesn't match the real origin, so cookies are dropped | Set it to the exact public origin and redeploy |
| Invitation emails never arrive | Supabase's built-in SMTP is heavily rate-limited | Configure your own SMTP in *Project Settings → Auth*, or hand out temporary passwords instead |
| Account creation fails for an admin | `SUPABASE_SERVICE_ROLE_KEY` not set on the server | Add it as a server-side variable and redeploy |

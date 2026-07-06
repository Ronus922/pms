# PMS — Production Deployment

## The only sanctioned way to run PMS

**PM2 is the sole owner of the PMS process and of port 3004.** Nothing else may
bind that port.

```bash
# The ONE canonical deploy (build in isolated worktree → atomic swap → PM2 reload)
bash /var/www/pms/scripts/deploy.sh [git-ref]     # default ref: feature/username-auth
```

`scripts/deploy-worktree.sh` and `scripts/prepare-standalone.sh` are thin
compatibility wrappers that `exec` into `scripts/deploy.sh`. There is **one**
deployment model.

## Forbidden in production

These recreate the 2026-07-06 crash-loop (8,268 restarts) and are never allowed:

- `pnpm start` / `next start` / `npm start` run by hand
- `nohup … &` or any shell-backgrounded app start
- `node .next/standalone/server.js` started outside PM2
- `lsof -ti:3004 | xargs kill -9`, `fuser -k 3004`, or any blind port-kill

If port 3004 is held by an unknown process, **do not blind-kill it.** Run the
canonical deploy — its pre-deploy guard prints the offender's PID, command,
parent PID and executable so you can stop it deliberately. If it is a stray
`nohup pnpm/next start`, kill it by that PID, then redeploy.

## What the canonical deploy guarantees

1. **Pre-deploy port guard** — refuses to deploy if :3004 is held by a non-PM2
   process (never blind-kills); continues cleanly if the port is free or held by
   the PM2-managed `pms` (a reload hands the port over).
2. **Isolated build** — builds in `/var/www/pms-build` so the live `.next` is
   never churned mid-serve; auto-creates that worktree if missing.
3. **Atomic swap + `pm2 reload`** with automatic rollback to the previous
   `.next` if verification fails.
4. **`pm2 save`** so the process survives reboots.
5. **Post-deploy verification** — exactly one listener on :3004, that listener is
   PM2-owned `pms`, HTTP 200, no new `EADDRINUSE`, and a stable restart count
   across a 20s observation window.

## Execution mode

PMS runs via `next start` (PM2 `script: npm`, `args: start`). `next.config.ts`
sets `output: 'standalone'`, and the standalone artifact was verified to serve
correctly **only after** copying `.next/static` and `public` into
`.next/standalone/` — but the standalone `server.js` does **not** load
`.env.local` (it `chdir`s into its own dir and reads only `process.env`), whereas
`next start` loads it natively. Switching to standalone would therefore need a
custom env launcher (`@next/env`'s `loadEnvConfig`) injecting the non-public
server vars; getting that wrong fails *silently and partially* (anon/home pages
work, DB/service-role/cron/email quietly 500). That risk is not worth taking on a
live app for a boot-speed gain, so `next start` is retained deliberately. To
revisit standalone later: add `cp -r .next/static .next/standalone/.next/static`
+ `cp -r public .next/standalone/public` to the deploy, add a verified
`@next/env` launcher, point PM2 at it, and verify a DB-dependent route end-to-end.

## PM2 crash-loop containment

`ecosystem.config.js`: `min_uptime: 30s`, `max_restarts: 15`, `restart_delay:
4000`, and **no** `exp_backoff_restart_delay`. The old config kept
`exp_backoff_restart_delay`, which makes PM2 restart forever with a growing delay
and stop honouring `max_restarts` as a hard cap — that is why the historical loop
never terminated. Now a genuine crash-loop is capped (PM2 → `errored`, site-health
alerts) while a transient crash that recovers past 30s resets the counter.

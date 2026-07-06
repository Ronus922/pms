module.exports = {
  apps: [
    {
      name: 'pms',
      // PM2 is the ONLY sanctioned owner of the PMS process and of port 3004.
      // Never start PMS with `pnpm start` / `next start` / `nohup` / bare `node`
      // outside PM2 — see scripts/deploy.sh (the one canonical deploy entry point)
      // and DEPLOYMENT.md.
      script: 'npm',
      args: 'start', // = `next start --port 3004`; env (.env.local) loaded natively by Next.
      cwd: '/var/www/pms',

      env: {
        NODE_ENV: 'production',
        PORT: 3004,
      },

      // ── Crash-loop containment ─────────────────────────────────────────────
      // History (2026-07-06): 8,268 restarts. Root cause was a NON-PM2 orphan
      // (`nohup pnpm start` from the old prepare-standalone.sh) holding :3004, so
      // every PM2 start died with EADDRINUSE. The prior config could not stop it
      // because `exp_backoff_restart_delay` makes PM2 restart FOREVER with a
      // growing delay and stops honouring `max_restarts` as a hard cap — so the
      // loop never terminated, it only slowed down. That option is removed.
      //
      // Now: a start that fails to stay up `min_uptime` counts as "unstable";
      // after `max_restarts` consecutive unstable starts PM2 marks the app
      // `errored` and STOPS (site-health then alerts). A transient crash that
      // recovers and stays up >30s resets the counter, so legitimate recovery is
      // unbounded — only a true crash-loop is capped.
      min_uptime: '30s',
      max_restarts: 15,
      restart_delay: 4000,
      autorestart: true,
      // exp_backoff_restart_delay: intentionally NOT set (see above).

      // Graceful reload: give Next time to drain in-flight requests on
      // stop/reload (default 1600ms can cut off PDF/Excel exports mid-response).
      kill_timeout: 8000,
      // How long PM2 waits for the app to be up before treating a reload as
      // failed. The app does not emit `process.send('ready')`, so `wait_ready`
      // is intentionally OFF; listen_timeout bounds the reload instead.
      listen_timeout: 10000,

      // Memory ceiling raised 512M → 1024M: exceljs + @react-pdf/renderer +
      // @turf can legitimately spike a single export past 512M, which under the
      // old ceiling caused a mid-request restart (failed export). 1G still
      // catches a real leak while giving export headroom (host has 22G).
      max_memory_restart: '1024M',

      out_file: '/home/ubuntu/.pm2/logs/pms-out.log',
      error_file: '/home/ubuntu/.pm2/logs/pms-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      watch: false,
      ignore_watch: ['node_modules', '.next', 'logs'],
    },
  ],
};

module.exports = {
  apps: [
    {
      name: 'pms',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/pms',

      // סביבה
      env: {
        NODE_ENV: 'production',
        PORT: 3004,
      },

      // יציבות — לא לאפשר קריסות אינסופיות
      max_restarts: 10,
      min_uptime: '10s',          // פחות מ-10 שניות = קריסה "unstable"
      restart_delay: 3000,        // 3 שניות המתנה בין ריסטארט לריסטארט
      exp_backoff_restart_delay: 100, // backoff אקספוננציאלי

      // מניעת memory leak
      max_memory_restart: '512M',

      // לוגים
      out_file: '/home/ubuntu/.pm2/logs/pms-out.log',
      error_file: '/home/ubuntu/.pm2/logs/pms-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // אל תפקח על שינויי קבצים ב-production
      watch: false,
      ignore_watch: ['node_modules', '.next', 'logs'],

      // אם נפל — תנסה שוב
      autorestart: true,
    },
  ],
};

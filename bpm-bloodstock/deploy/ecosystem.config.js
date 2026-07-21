// PM2 process definition for BPM Bloodstock on admin.jtbassetgroup.com
//
//   pm2 start deploy/ecosystem.config.js
//   pm2 save && pm2 startup      # survive reboots
//
// The app listens on 127.0.0.1:3000 only — never exposed directly; Nginx
// reverse-proxies https://admin.jtbassetgroup.com to it.
module.exports = {
  apps: [
    {
      name: "bpm-bloodstock",
      // Absolute path to the app dir on the server — ADJUST if you clone elsewhere.
      cwd: "/var/www/admin.jtbassetgroup.com/bpm-bloodstock",
      // Run Next's server directly (more reliable under PM2 than `npm start`).
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};

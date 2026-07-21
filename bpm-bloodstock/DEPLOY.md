# Deploying BPM Bloodstock to `admin.jtbassetgroup.com` (Onidel)

This app is a **Next.js Node server**, not a PHP/static site. It runs as a
long-lived process on `127.0.0.1:3000` and Nginx reverse-proxies the subdomain
to it. Below is the one-time setup, then the repeatable redeploy.

> Run everything yourself via the panel's **Open Terminal** (or SSH). Never
> paste your server password or Stripe **secret** keys into any chat.

---

## 0. Prerequisites on the server

- **Node.js 20+** and **PM2**. Check, and install if missing:
  ```bash
  node -v            # want v20 or newer
  # If missing, install via nvm (per-user, no root needed):
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  . ~/.nvm/nvm.sh && nvm install 20
  npm i -g pm2
  ```

## 1. DNS + site (Onidel panel)

1. **DNS:** add an `A` record `admin` → `160.22.78.31` (your server IP).
2. In the panel, **create a new site** `admin.jtbassetgroup.com` and enable
   **HTTPS / Let's Encrypt** for it. This creates `/var/www/admin.jtbassetgroup.com`
   and provisions the SSL cert.

## 2. Get the code onto the server

The app lives in the `bpm-bloodstock/` subfolder of the `harnesslink` repo.
Use the panel's **Git** feature, a **deploy key**, or an HTTPS token:

```bash
cd /var/www/admin.jtbassetgroup.com
git clone <your-repo-url> .          # clones repo contents into this dir
git checkout claude/bloodstock-microshares-platform-u22lsi
cd bpm-bloodstock
```

## 3. Configure environment

```bash
cp deploy/.env.production.example .env
# Generate a session secret:
openssl rand -base64 48
# Edit .env — paste the secret, set NEXT_PUBLIC_APP_URL, add Stripe keys later.
nano .env
chmod 600 .env
```

Leave the Stripe keys blank for now → the app runs in **demo mode** (wallet
top-ups are simulated). Add live keys when you're ready to take real money.

## 4. First build + database + start

```bash
npm ci
npx prisma migrate deploy        # creates prisma/prod.db and its schema
npm run db:seed                  # OPTIONAL: demo horses + users. Skip for a clean start.
npm run build
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup                      # follow the printed command so it survives reboots
```

The app is now listening on `127.0.0.1:3000`.

## 5. Point Nginx at it (Onidel panel)

The panel owns the Nginx `server{}` block + SSL, so **don't** paste the whole
`deploy/nginx-admin.jtbassetgroup.com.conf`. Instead, on the
`admin.jtbassetgroup.com` site:

- Use the panel's **Reverse Proxy** option → target `http://127.0.0.1:3000`, **or**
- Paste just the `location / { … }` block from
  `deploy/nginx-admin.jtbassetgroup.com.conf` into the site's custom/advanced
  Nginx config.

Reload Nginx (panel button or `sudo nginx -s reload`), then visit
**https://admin.jtbassetgroup.com** — you should see the BPM landing page.

Seeded logins (if you ran the seed): `admin@bpmbloodstock.com` / `password123`.
**Change or remove these before any real use.**

---

## Redeploying (every update after)

```bash
cd /var/www/admin.jtbassetgroup.com/bpm-bloodstock
./deploy/deploy.sh
```

That pulls, installs, migrates, rebuilds, and reloads PM2 with zero-ish downtime.

---

## Going live with real payments

1. Add **live** Stripe keys to `.env` and restart: `pm2 reload bpm-bloodstock`.
2. In Stripe → Developers → Webhooks, add endpoint
   `https://admin.jtbassetgroup.com/api/stripe/webhook`, subscribe to
   `payment_intent.succeeded`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Replace the withdrawal stub with real **Stripe Connect** payouts (see README).
4. **Compliance before taking public money** — fractional racehorse ownership is
   typically a regulated financial product (AFSL/PDS) plus racing-authority
   syndication rules and AML/KYC. Get advice first.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| 502 Bad Gateway | Is the app up? `pm2 status`, `pm2 logs bpm-bloodstock` |
| Blank / asset errors | Did `npm run build` succeed? Rebuild + `pm2 reload` |
| DB write errors | The app user must own/write `prisma/` (the SQLite file) |
| Cookie/login issues | `NEXT_PUBLIC_APP_URL` must be the real `https://` URL |

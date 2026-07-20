# Deploying Harnesslink to staging

A one-command Docker Compose stack: **Postgres + Rails API + Next.js site**.
This is staging — it serves 20 demo articles (real slugs/metadata, placeholder
bodies) until the importer runs.

## Prerequisites on the staging box

- Docker + Docker Compose plugin (`docker compose version`)
- Ports: one host port for the site (default `8080`)

## Steps

```bash
# 1. Get the code onto the server (git clone or upload this repo)
git clone <your-repo> harnesslink && cd harnesslink
git checkout claude/harnesslink-v1-brief-nrksgw

# 2. Configure secrets
cp .env.example .env
#   - SECRET_KEY_BASE: run  openssl rand -hex 64
#   - DB_PASSWORD:     any strong password
#   - WEB_PORT:        host port for the site (default 8080)
$EDITOR .env

# 3. Build and start
docker compose up -d --build

# 4. Watch it come up (the API seeds the DB on first boot)
docker compose logs -f api
```

Visit `http://<server-ip>:8080`. You should see the navy Harnesslink homepage
with the card grid.

## Putting it on staging.harnesslink.com with TLS

The `web` service listens on the `WEB_PORT` you set. Terminate TLS in front of
it with **Cloudflare** (orange-cloud the `staging` record) or the host's
**nginx** reverse-proxying `staging.harnesslink.com → 127.0.0.1:8080`. Once TLS
terminates upstream, set `RAILS_FORCE_SSL=true` in `.env` and
`docker compose up -d` again.

## Operating it

```bash
docker compose ps                      # status
docker compose logs -f web             # site logs
docker compose exec api ./bin/rails console   # Rails console
docker compose exec api ./bin/rails db:seed   # re-run seeds
docker compose down                    # stop (keeps the pgdata volume)
docker compose down -v                 # stop AND wipe the database
```

## What's wired

- **db** — Postgres 16, data persisted in the `pgdata` volume.
- **api** — Rails (production): single database, in-memory cache, async jobs
  (no Redis). Serves JSON on port 80 inside the network; not exposed to the host.
  The entrypoint runs `db:prepare` (migrate + seed) on first boot.
- **web** — Next.js standalone server on port 3000, mapped to `WEB_PORT`.
  Fetches the API server-side at `http://api` (no browser CORS).

## Notes / next steps

- Pages currently render **server-side per request** (always live). We switch to
  ISR (static + revalidate) for production once the importer has populated real
  content — that's the Core Web Vitals win.
- Article **bodies and photos are placeholders** until the importer (Step 5) runs.
- Media (`api/storage`) is on the local disk in this stack; production moves it
  to object storage + imgproxy (Step 6).
- For a registry-based, zero-downtime deploy later, the repo also ships Rails'
  **Kamal** config (`api/config/deploy.yml`).

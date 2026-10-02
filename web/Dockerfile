# syntax=docker/dockerfile:1
# Production image for the Next.js public site (standalone output).

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The build needs no running API (data fetches fail soft), but it does need the
# API's ADDRESS: next.config.ts rewrites (sitemaps, feed, /api/subscribe, ad
# click + view tracking) are baked into the build. Default = the compose
# service name; override with --build-arg API_BASE=… for other topologies.
ARG API_BASE=http://api
ENV API_BASE=$API_BASE
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
RUN useradd --create-home --shell /bin/bash nextjs
# Standalone server + the static assets and public files it serves.
COPY --from=build --chown=nextjs:nextjs /app/public ./public
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
# API_BASE is read at runtime (server-side), set by docker-compose.
CMD ["node", "server.js"]

# syntax=docker/dockerfile:1
# Production image for the Strapi CMS.

FROM node:22-slim AS build
WORKDIR /app
ENV STRAPI_TELEMETRY_DISABLED=true
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The admin panel is compiled for its public address (incl. any sub-folder,
# e.g. https://staging.harnesslink.com/cms), so it is a build argument.
ARG PUBLIC_URL=
ARG ADMIN_COOKIE_PATH=/admin
ENV PUBLIC_URL=$PUBLIC_URL ADMIN_COOKIE_PATH=$ADMIN_COOKIE_PATH NODE_ENV=production
RUN npm run build && npm prune --omit=dev

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production STRAPI_TELEMETRY_DISABLED=true
COPY --from=build /app ./
RUN mkdir -p public/uploads && chown -R node:node public/uploads .tmp 2>/dev/null || chown -R node:node public/uploads
USER node
EXPOSE 1337
CMD ["npm", "run", "start"]

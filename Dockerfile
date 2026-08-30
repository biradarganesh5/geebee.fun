# Build the Astro site, then serve the static output with nginx.
#
# Self-contained on purpose: `docker build .` reproduces exactly what CI does, so
# a broken build can be diagnosed locally instead of by pushing commits and
# watching Actions.

# ---- build stage ----------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Copy manifests first so the dependency layer caches independently of source
# changes: editing a component does not trigger a full reinstall.
COPY package.json package-lock.json ./

# `npm ci` (not `npm install`) installs exactly what the lockfile pins, which is
# what makes the build reproducible.
RUN npm ci

COPY . .

# This project's `build` script also runs validate:content and `astro check`, so
# content and type errors fail the build rather than shipping silently.
RUN npm run build

# ---- runtime stage --------------------------------------------------------
# nginx-unprivileged runs as a non-root user and listens on 8080 instead of 80,
# which is what lets the pod run with no added capabilities.
FROM nginxinc/nginx-unprivileged:1.31.4-alpine

# Astro's `output: 'static'` build lands in dist/.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

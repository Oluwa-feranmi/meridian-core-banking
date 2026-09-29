# =============================================================================
# Meridian Core Banking Web Console — frontend Dockerfile
#
# Two-stage build:
#   1. "build"      — installs dependencies, runs the Vite production
#                      build (React → static HTML/JS/CSS bundle).
#   2. "production"  — a plain nginx:alpine image serving only the static
#                      output from stage 1. There is no Node.js runtime,
#                      no npm, no source code in the final image at all —
#                      it's the smallest and least attackable shape a
#                      frontend container can take.
#
# VITE_API_BASE_URL is a BUILD-TIME argument, not a runtime environment
# variable — Vite inlines it into the compiled JS bundle at `npm run
# build` time, since browser code cannot read server-side env vars at
# request time the way the backend can. This means the frontend image
# must be rebuilt (not just restarted) if the backend's URL changes
# between environments — see docker-compose.yml and docs/02 for how this
# maps to ALB DNS names in AWS.
# =============================================================================

# ---- Stage 1: build ----------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/tsconfig.json frontend/vite.config.ts frontend/index.html ./
COPY frontend/src ./src

ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ---- Stage 2: production ------------------------------------------------
FROM nginx:1.27-alpine AS production

COPY frontend/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/nginx-health || exit 1

CMD ["nginx", "-g", "daemon off;"]

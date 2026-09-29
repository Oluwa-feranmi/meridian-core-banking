# =============================================================================
# Meridian Core Banking API — backend Dockerfile (Local Development)
#
# Two-stage build:
#   1. "build"      — installs ALL dependencies (incl. devDependencies),
#                      compiles TypeScript to JavaScript.
#   2. "production"  — installs ONLY production dependencies, copies just
#                      the compiled output from stage 1. The final image
#                      never contains TypeScript source, ts-node, eslint,
#                      or any other dev tooling — smaller image, smaller
#                      attack surface, faster ECS task startup/pull time.
# =============================================================================

# ---- Stage 1: build ----------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Copy only manifest files first so Docker's layer cache is reused on
# every rebuild where dependencies haven't changed — only source-code
# changes will invalidate layers from this point forward.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# ---- Stage 2: production ------------------------------------------------
FROM node:20-alpine AS production

# Run as a dedicated non-root user rather than the image's default root —
# if the container is ever compromised, the process has no privilege to
# modify anything outside its own working directory.
RUN addgroup -S meridian && adduser -S meridian -G meridian

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts

# Fix permissions for non-root user
RUN chown -R meridian:meridian /app

USER meridian

EXPOSE 4000

# Container-level health check, independent of the ALB's target group
# health check. This is what `docker ps` and ECS's own container-agent
# health monitoring use to decide whether to restart a stuck process,
# even if it's still technically listening on the port. Uses Node's
# built-in fetch (no curl/wget installed in the slim alpine image, which
# keeps the image smaller) against the fast, dependency-free /health/live
# endpoint — not /health/ready, since a container health check shouldn't
# fail just because the database is briefly unreachable.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "-r", "module-alias/register", "dist/server.js"]

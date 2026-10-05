# Production image for the storefront (apps/storefront).
#
#   docker build -t josemadridsalsa:latest --build-arg NODE_VERSION=20 -f Dockerfile .
#   docker run --rm -p 3000:3000 --env-file .env.local josemadridsalsa:latest
#
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# must be present during `docker build`, not just at `docker run`. Pass them with
# a BuildKit secret (never a --build-arg, which is recorded in image history):
#
#   docker build --no-cache-filter builder --secret id=build_env,src=.env.local \
#     -t josemadridsalsa:latest .
#
# --no-cache-filter is required, not cosmetic: BuildKit keeps secret contents out of
# the layer cache key, so editing a value in the env file does not invalidate the
# builder layer and the previous run's values would stay compiled into the bundle.
#
# Migrations are not run by this image. Apply them separately with
# `npm run db:deploy` against DATABASE_URL_UNPOOLED.

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-bookworm-slim AS base
# Prisma's query engine needs OpenSSL. The builder and runner stages must stay on
# the same base: schema.prisma declares binaryTargets ["native", "rhel-openssl-3.0.x"],
# so "native" is resolved to this image's platform when the client is generated.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    HUSKY=0

# --- deps: install the workspace tree from the lockfile ---------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/docs/package.json ./apps/docs/
COPY apps/fundraising/package.json ./apps/fundraising/
COPY apps/storefront/package.json ./apps/storefront/
# The storefront's postinstall runs `prisma generate`, so the schema must exist
# before install.
COPY apps/storefront/prisma ./apps/storefront/prisma
RUN npm ci --legacy-peer-deps

# --- builder: next build in standalone mode --------------------------------
FROM base AS builder
# The TypeScript pass over this codebase exceeds Node's default heap, which is
# derived from container memory — a machine with less RAM gets a smaller default
# and dies with "JavaScript heap out of memory". Raise it here rather than
# depending on the host's size. The daemon still needs enough memory to honour
# this: on Docker Desktop, allow at least 8 GB.
ARG NODE_MAX_OLD_SPACE=4096
ENV NODE_OPTIONS=--max-old-space-size=${NODE_MAX_OLD_SPACE}
# next.config.mjs only sets `output: 'standalone'` when this is set, so the
# Vercel build path is unchanged.
ENV DOCKER_BUILD=1
COPY --from=deps /app ./
COPY . .
RUN --mount=type=secret,id=build_env,target=/app/apps/storefront/.env.production \
    npx turbo run build --filter=@jose-madrid/storefront --env-mode=loose

# --- runner: minimal runtime -----------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
# outputFileTracingRoot is the monorepo root, so the standalone tree is rooted
# at the workspace: node_modules/ at the top, server.js under apps/storefront/.
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/public ./apps/storefront/public
# Belt and braces: the generated Prisma client is pulled in by file tracing, but
# a missing engine only surfaces at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
USER nextjs
EXPOSE 3000
CMD ["node", "apps/storefront/server.js"]

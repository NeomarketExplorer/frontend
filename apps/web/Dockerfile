# Web App Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/api/package.json ./packages/api/
COPY packages/config/package.json ./packages/config/
COPY packages/trading/package.json ./packages/trading/
# Use hoisted node_modules to avoid pnpm symlinks breaking in standalone output
RUN echo "node-linker=hoisted" > .npmrc
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
# Copy all installed deps (hoisted = everything in root node_modules)
COPY --from=deps /app/ ./

COPY apps/web ./apps/web
COPY packages/ui ./packages/ui
COPY packages/api ./packages/api
COPY packages/config ./packages/config
COPY packages/trading ./packages/trading
COPY tsconfig.base.json ./

WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars are inlined at build time
ARG NEXT_PUBLIC_PRIVY_APP_ID
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID

RUN pnpm build

# Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone output preserves monorepo structure
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# Copy public to both locations - Next.js standalone serves from ./public relative to server.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]

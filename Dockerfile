# Multi-stage build for the multi-agent hub
# This Dockerfile is for local development and testing with the mock MCP server

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/ ./packages/
COPY apps/edge-hub/ ./apps/edge-hub/
RUN pnpm install --frozen-lockfile
RUN pnpm build --filter edge-hub

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/edge-hub/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8787

# For local dev: run the mock MCP server alongside
FROM base AS dev
WORKDIR /app
COPY . .
RUN pnpm install
EXPOSE 8787 3001
CMD ["pnpm", "dev"]
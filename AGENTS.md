# AGENTS.md — Multi-Agent Hub (Midas)

> Agent context file for AI coding assistants (Claude Code, Cursor, Copilot, etc.).
> This file enables any agent to understand, navigate, and extend the project effectively.

## Project Identity

- **Name**: Multi-Agent Hub (codename: Midas)
- **Purpose**: Lightweight, edge-native multi-agent orchestration platform
- **Runtime**: Cloudflare Workers (V8 isolates)
- **Language**: TypeScript 5.7+ (strict mode)
- **Package Manager**: pnpm 9.15+ (monorepo with Turborepo)
- **Testing**: Vitest 2.1+
- **API Framework**: Hono.js 4.6+

## Repository Structure

```
/
├── apps/
│   ├── edge-hub/          # Cloudflare Worker — Hono.js API server
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point, routes, middleware
│   │   │   ├── ingress-router.ts  # Auth & request routing
│   │   │   ├── lead-workflow.ts   # Lead Agent orchestrator
│   │   │   ├── sub-agent-workflow.ts # Sandboxed sub-agent
│   │   │   ├── execution-tracer.ts   # Trace/diff logging
│   │   │   ├── routes/            # Route handlers (agents, chat, mcp, workspace, telegram)
│   │   │   └── telegram/          # Telegram bot integration
│   │   └── tests/
│   ├── web-ui/            # React 19 + Vite + Tailwind dashboard
│   │   └── src/
│   │       ├── components/  # UI components (chat, editor, diff, trace, mcp, layout, sandbox)
│   │       ├── hooks/       # React hooks (useAutoLinting, useVFSClient)
│   │       ├── store/       # Zustand stores (workspace, theme, chat, mcp, agents)
│   │       └── api/         # API client
│   └── native/            # Expo (React Native) app — iOS, Android, Web
│       └── src/
│           ├── app/          # Expo Router pages
│           ├── components/   # RN components
│           ├── hooks/        # Custom hooks
│           └── services/     # API client
├── packages/
│   ├── contracts/         # Shared Zod schemas, branded types, error classes
│   ├── compiler/          # Markdown prompt compiler (file concatenator, token estimator, diff generator, prompt builder)
│   ├── vfs/               # Virtual File System (S3 fetch client, KV cache, workspace hydrator, deferred flusher)
│   ├── mcp-edge/          # Edge-native MCP transport (SSE consumer, JSON-RPC parser, schema translator)
│   ├── ai-provider/       # LLM provider abstraction (OpenAI, Anthropic, provider factory)
│   └── ui-shared/         # Shared UI utilities (cn, formatTimestamp, etc.)
├── tooling/
│   ├── mock-mcp-server/   # Local MCP test server (Express + SSE)
│   ├── r2-concurrency-probe/ # R2 latency/throughput tester
│   └── scripts/           # CLI tools, simulators, telemetry
├── docs/                  # Project documentation
├── .github/workflows/     # CI/CD pipelines
└── AGENTS.md              # THIS FILE
```

## Key Architecture Decisions

1. **Edge-native**: All packages use Web APIs only (fetch, ReadableStream, AbortSignal, crypto.subtle) — no Node.js `fs`, `net`, or `http`. Ensures Cloudflare Workers compatibility.

2. **Markdown-defined personas**: Agent personality = 5 markdown files (soul.md, identity.md, user.md, memory.md, tools.md) stored in R2. No database needed.

3. **Hierarchical orchestration**: Lead Agent has global read/write across all workspaces + ability to spawn/modify sub-agents. Sub-agents are strictly isolated to their own workspace.

4. **MCP for tool connectivity**: All external tools connect via Model Context Protocol over SSE. Custom `@midas/mcp-edge` package handles SSE consumption, JSON-RPC, schema translation.

5. **Deferred flushing**: Memory writes use `ctx.waitUntil()` for async background flush after HTTP response.

6. **Zero heavy dependencies**: Token estimator, diff generator, S3 client are all zero-dependency pure functions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (V8) |
| API | Hono.js |
| Storage | R2 (files) + KV (cache) |
| AI Providers | OpenAI + Anthropic |
| MCP Transport | Edge SSE (custom) |
| Web UI | React 19 + Vite + Tailwind CSS |
| Native | Expo (React Native) |
| State | Zustand + TanStack Query |
| Validation | Zod 3.24 |
| Monorepo | pnpm + Turborepo |
| Testing | Vitest |
| Linting | ESLint 9 + typescript-eslint strict |
| CI/CD | GitHub Actions → CF Workers/Pages |

## Common Development Commands

```bash
# Setup
pnpm install
cp .dev.vars.example apps/edge-hub/.dev.vars

# Development (parallel)
pnpm dev                          # All apps with Turborepo
pnpm --filter @midas/edge-hub dev # Just the worker
pnpm --filter @midas/web-ui dev   # Just the UI

# Testing & Quality
pnpm test       # Run all tests
pnpm lint       # ESLint
pnpm typecheck  # TypeScript check
pnpm build      # Production build

# Deployment
pnpm deploy:edge  # Cloudflare Workers
pnpm deploy:web   # Cloudflare Pages
pnpm deploy:native # EAS Update
```

## Configuration Files

| File | Purpose |
|------|---------|
| `apps/edge-hub/wrangler.toml` | Cloudflare Worker config |
| `apps/web-ui/vite.config.ts` | Vite dev/build config |
| `turbo.json` | Turborepo pipeline |
| `tsconfig.base.json` | Shared TS strict config |
| `eslint.config.mjs` | Flat ESLint config |
| `.env.example` | Production env template |
| `.dev.vars.example` | Local dev secrets template |

## Data Flow

```
Client → Hono.js Router → Ingress Auth → Lead Workflow
  → Workspace Hydrator (R2 + KV cache)
  → Prompt Compiler (concatenate .md files)
  → AI Provider (LLM call)
  → Tool Calls (MCP SSE client)
  → Response Stream (SSE or JSON)
  → Deferred Flusher (waitUntil → R2 write)
```

## Adding a New Feature

1. **New route**: Add handler in `apps/edge-hub/src/routes/`, register in `index.ts`
2. **New package**: Create in `packages/`, add to `pnpm-workspace.yaml`
3. **New schema**: Add Zod schema in `packages/contracts/src/`
4. **New AI provider**: Implement `AIProvider` interface in `packages/ai-provider/src/`
5. **New UI page**: Add route in `apps/web-ui/src/App.tsx` or `apps/native/src/app/`

## Validation Rules

- All Zod schemas live in `@midas/contracts` — shared across backend + frontend
- Edge hub uses Hono validation middleware (Zod validator)
- Web UI uses Zod + TanStack Query for API contract enforcement
- Branded types (`AgentId`, `WorkspaceId`) prevent ID confusion at type level

## Production Considerations

- **Secrets**: Always use `wrangler secret put` — never commit to `.dev.vars`
- **Cache**: KV read-through cache with 5 min TTL; invalidate on write
- **Observability**: Structured JSON logging via `console.warn/error` + Cloudflare observability
- **Auth**: Session tokens (in production, use proper JWT or OAuth)
- **Rate limiting**: Hono middleware for request throttling
- **Path traversal**: Blocked in `lead-workflow.ts` with explicit validation

## Extension Points

- **New LLM provider**: Add class implementing `AIProvider` in `@midas/ai-provider`
- **New MCP transport**: Extend `@midas/mcp-edge` with WebSocket or gRPC support
- **New client**: Use the Hono REST API at `GET /api/*`
- **New agent type**: Subclass `LeadWorkflow` or `SubAgentWorkflow` patterns
- **New storage backend**: Implement VFS interface with any S3-compatible store
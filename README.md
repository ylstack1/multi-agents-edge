# Multi-Agent Hub (Midas)

> **Lightweight, edge-native multi-agent orchestration platform** — define AI agents with markdown files, connect tools via MCP, and interact from any surface.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Runtime-Cloudflare_Workers-f38020)](https://workers.cloudflare.com/)
[![Hono.js](https://img.shields.io/badge/API-Hono.js-ff6b6b)](https://hono.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-9.15-f69220)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-ef4444)](https://turbo.build/)
[![Vitest](https://img.shields.io/badge/Test-Vitest-6b9f3b)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Quick Links

| If you're looking for... | Start here |
|--------------------------|-----------|
| **Getting started in 5 minutes** | [Quickstart Guide](./docs/QUICKSTART.md) |
| **System design & architecture** | [Architecture Guide](./docs/ARCHITECTURE.md) |
| **Deploying to production** | [Deploy Guide](./docs/DEPLOY_GUIDE.md) |
| **Production readiness checklist** | [Production Checklist](./docs/PRODUCTION_CHECKLIST.md) |
| **Complete API reference** | [API Reference](./docs/API_REFERENCE.md) |
| **Contributing & local dev** | [Development Guide](./docs/DEVELOPMENT.md) |
| **AI coding assistant context** | [AGENTS.md](./AGENTS.md) |

---

## What is Multi-Agent Hub?

Multi-Agent Hub is a platform for orchestrating **hierarchical AI agents** at the edge. Each agent's personality is defined by markdown files stored in Cloudflare R2, tools are connected via the Model Context Protocol (MCP), and agents interact through a lead-agent / sub-agent hierarchy.

### Key Capabilities

- **Markdown-defined personas** — 5 markdown files (soul, identity, user, memory, tools) define each agent
- **Hierarchical orchestration** — Lead Agent manages sub-agents with workspace isolation
- **MCP tool connectivity** — Connect any MCP-compatible tool server via SSE
- **Edge-native** — 100% Cloudflare Workers compatible (Web APIs only, no Node.js)
- **Cross-platform clients** — Web dashboard, native mobile (Expo), Telegram bots

### Clients

| Client | Technology | Purpose |
|--------|-----------|---------|
| Web UI | React 19 + Vite + Tailwind CSS | Dashboard for managing agents, chat, and MCP |
| Native App | Expo (React Native) | iOS, Android, and mobile-web access |
| Telegram Bot | Bot API via webhook | Agent interactions via Telegram messaging |

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure local environment
cp .dev.vars.example apps/edge-hub/.dev.vars
# Edit .dev.vars with your API keys (OpenAI and/or Anthropic)

# 3. Start development servers (in separate terminals)
pnpm --filter @midas/edge-hub dev    # Cloudflare Worker → http://localhost:8787
pnpm --filter @midas/web-ui dev      # Web Dashboard  → http://localhost:5173

# 4. Verify it works
curl http://localhost:8787/health
# → { "ok": true, "version": "0.1.0" }
```

> **Full setup guide → [Quickstart Guide](./docs/QUICKSTART.md)**

---

## Architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Web UI     │  │  Native App  │  │  Telegram    │
│  (React)     │  │  (Expo)      │  │  (Bot API)   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                  │
       └─────────────────┼──────────────────┘
                         │ HTTP / SSE
                         ▼
               ┌───────────────────┐
               │    Edge Hub       │  Cloudflare Worker
               │   (Hono.js)       │  (V8 Isolate)
               └────────┬──────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
   ┌──────────┐  ┌──────────┐  ┌──────────────┐
   │   R2     │  │    KV    │  │  MCP Edge    │
   │   VFS    │  │  Cache   │  │  (SSE Client)│
   └──────────┘  └──────────┘  └──────┬───────┘
                                      │
                               ┌──────┴──────┐
                               │ MCP Servers │
                               │  (Tools)    │
                               └─────────────┘
```

**How it works:**

1. **Client sends message** → Edge Hub routes to Lead Agent
2. **Workspace hydration** → Agent's markdown files fetched from R2 (via KV cache)
3. **Prompt compilation** → Files stitched into LLM system prompt
4. **LLM call** → AI provider processes request with tool definitions
5. **Tool execution** → MCP SSE client discovers & executes tools
6. **Response** → Streamed back to client; memory flushed to R2

> **Detailed architecture → [Architecture Guide](./docs/ARCHITECTURE.md)**

---

## Project Structure

```
multi-agent-hub/
├── apps/
│   ├── edge-hub/          # Cloudflare Worker (Hono.js)
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point, routes, middleware
│   │   │   ├── ingress-router.ts  # Auth & request routing
│   │   │   ├── lead-workflow.ts   # Lead Agent orchestrator
│   │   │   ├── sub-agent-workflow.ts # Sandboxed sub-agent
│   │   │   ├── execution-tracer.ts   # Trace/diff logging
│   │   │   ├── routes/            # Route handlers
│   │   │   └── telegram/          # Telegram integration
│   │   └── tests/
│   ├── web-ui/            # React dashboard (Vite + Tailwind)
│   └── native/            # Expo cross-platform app
├── packages/
│   ├── contracts/         # Shared Zod schemas & branded types
│   ├── compiler/          # Markdown prompt compiler
│   ├── vfs/               # Virtual File System (S3 + KV)
│   ├── mcp-edge/          # Edge-native MCP transport
│   ├── ai-provider/       # LLM provider abstraction
│   └── ui-shared/         # Shared UI utilities
├── tooling/
│   ├── mock-mcp-server/   # Local MCP test server
│   ├── r2-concurrency-probe/ # R2 latency tester
│   └── scripts/           # CLI tools & telemetry
├── docs/                  # 📚 Project documentation
│   ├── ARCHITECTURE.md    # System design deep-dive
│   ├── QUICKSTART.md      # 5-minute setup guide
│   ├── DEPLOY_GUIDE.md    # Production deployment guide
│   ├── PRODUCTION_CHECKLIST.md # Pre-flight checklist
│   ├── API_REFERENCE.md   # Complete API documentation
│   └── DEVELOPMENT.md     # Contributing guide
├── AGENTS.md              # 🤖 AI assistant context file
└── .github/workflows/     # CI/CD pipelines
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | [Cloudflare Workers](https://workers.cloudflare.com/) (V8 isolates) |
| **API Framework** | [Hono.js](https://hono.dev/) v4.6 |
| **Storage** | Cloudflare [R2](https://developers.cloudflare.com/r2/) (files) + [KV](https://developers.cloudflare.com/kv/) (cache) |
| **AI Providers** | OpenAI & Anthropic (adapter pattern) |
| **MCP Transport** | Edge-native SSE (custom implementation) |
| **Web UI** | React 19 + Vite 6 + Tailwind CSS 3.4 |
| **Native App** | Expo SDK 52 (React Native) |
| **Validation** | Zod 3.24 — shared schemas across backend & frontend |
| **Monorepo** | pnpm 9.15 + Turborepo |
| **Testing** | Vitest 2.1 |
| **Linting** | ESLint 9 + typescript-eslint (flat config) |
| **CI/CD** | GitHub Actions → Cloudflare Workers / Pages |

---

## Core Concepts

### Markdown Workspace

Every agent has a workspace with 5 markdown files that define its entire persona:

| File | Purpose |
|------|---------|
| `soul.md` | Core values, tone, personality |
| `identity.md` | Role definition, expertise, metadata |
| `user.md` | Human operator context and goals |
| `memory.md` | Episodic logs, conversation history |
| `tools.md` | MCP tool definitions (JSON or docs) |

### Agent Hierarchy

- **Lead Agent**: Global read/write access to all workspaces. Can spawn and modify sub-agents via system tools.
- **Sub-Agents**: Strictly isolated to their own workspace. No knowledge of other agents or system-level capabilities.

### MCP Extensibility

All external tools connect via the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP):
1. Connect to MCP server via SSE
2. Discover available tools
3. Translate schemas to LLM function-calling format
4. Execute tools with timeout safety

---

## Documentation

All project documentation lives in the [`docs/`](./docs/) directory:

| Document | Description |
|----------|-------------|
| [**Quickstart Guide**](./docs/QUICKSTART.md) | Local setup in 5 minutes |
| [**Architecture Guide**](./docs/ARCHITECTURE.md) | System design, data flow, decisions |
| [**Deploy Guide**](./docs/DEPLOY_GUIDE.md) | Production deployment to Cloudflare |
| [**Production Checklist**](./docs/PRODUCTION_CHECKLIST.md) | Pre-deployment validation |
| [**API Reference**](./docs/API_REFERENCE.md) | All endpoints, auth, error codes |
| [**Development Guide**](./docs/DEVELOPMENT.md) | Contributing, testing, conventions |

For AI coding assistants, [**AGENTS.md**](./AGENTS.md) provides the full project context.

---

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all apps in dev mode (Turborepo) |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run all tests |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm format` | Format code with Prettier |
| `pnpm deploy:edge` | Deploy Edge Hub to Cloudflare Workers |
| `pnpm deploy:web` | Deploy Web UI to Cloudflare Pages |
| `pnpm deploy:native` | Deploy native app via EAS |
| `pnpm ci` | Full CI pipeline (lint → typecheck → test → build) |

---

## License

MIT — see [LICENSE](LICENSE) for details.
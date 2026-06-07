# Architecture Guide

> Deep-dive into the Multi-Agent Hub (Midas) architecture, design decisions, and system interactions.

## Table of Contents

- [System Overview](#system-overview)
- [Core Architecture](#core-architecture)
- [Agent Workflow](#agent-workflow)
- [Package Design](#package-design)
- [Data Flow](#data-flow)
- [Security Model](#security-model)
- [Edge Compatibility](#edge-compatibility)

---

## System Overview

Multi-Agent Hub is a **hierarchical multi-agent orchestration platform** built exclusively for Cloudflare Workers. It uses markdown files to define AI agent personalities, the Model Context Protocol (MCP) for tool connectivity, and provides three client surfaces: a web dashboard, a native mobile app, and Telegram bots.

### Design Tenets

1. **Edge-only**: Every package must run in Cloudflare Workers (V8 isolates). No Node.js-specific APIs.
2. **Stateless worker, stateful storage**: The worker is stateless; all state lives in R2 + KV.
3. **Markdown as configuration**: Agent personality is entirely defined by 5 markdown files.
4. **MCP for everything**: All external tool integrations go through the Model Context Protocol.
5. **Zero heavy dependencies**: Token estimation, diff generation, S3 client are zero-dependency.

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Clients                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Web UI   │  │  Native  │  │ Telegram │               │
│  │(React)   │  │ (Expo)   │  │ (Bot API)│               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       │             │             │                       │
│       └─────────────┼─────────────┘                       │
│                     │ HTTP/SSE                            │
├─────────────────────┼─────────────────────────────────────┤
│                     ▼                                     │
│           ┌─────────────────┐                             │
│           │   Edge Hub      │     Cloudflare Worker       │
│           │  (Hono.js)      │     (V8 Isolate)            │
│           └────────┬────────┘                             │
│                    │                                      │
│    ┌───────────────┼───────────────┐                      │
│    ▼               ▼               ▼                      │
│ ┌────────┐   ┌────────┐    ┌──────────┐                  │
│ │  R2    │   │  KV    │    │ MCP Edge │                  │
│ │ VFS    │   │ Cache  │    │ (SSE)    │                  │
│ └────────┘   └────────┘    └────┬─────┘                  │
│                                 │                         │
│                    ┌────────────┴────────────┐            │
│                    │    External MCP Servers  │            │
│                    │ (Tools: search, compute, │            │
│                    │  images, APIs, etc.)     │            │
│                    └─────────────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

### Edge Hub (`apps/edge-hub`)

The central API gateway — a Hono.js application deployed to Cloudflare Workers.

**Entry Point** (`src/index.ts`):
- Hono app with global middleware: logger, secure headers, CORS
- Health check `GET /health`
- All `/api/*` routes protected by `ingressRouter` auth middleware
- Telegram webhook at `/webhook/telegram` (token-verified, no session auth)
- Global error handler with structured error responses

**Auth Layer** (`ingress-router.ts`):
- Extracts `Authorization: Bearer <token>` or `X-Session-Token` header
- Base64-decodes token, extracts `agentId:source`
- In production: TODO migration to JWT or OAuth
- Attaches identity to Hono context via `.set('agentId', ...)` / `.set('source', ...)`

### Agent Workflow Engine

**Lead Agent** (`lead-workflow.ts`):
- Has privileged access: can read/write all workspaces
- Can spawn new sub-agents and modify sub-agent files
- Injected system tools: `modify_sub_agent`, `spawn_sub_agent`
- Path traversal protection on all file operations
- Two-step LLM call: tool execution → final synthesis

**Sub-Agent** (`sub-agent-workflow.ts`):
- Sandboxed to own workspace: only reads/writes `agents/<id>/files/*`
- No system-level tools
- Extracts tool definitions from `tools.md`
- Appends conversation to `memory.md` via deferred flush

### Storage Layer

| System | Purpose | Access Pattern |
|--------|---------|---------------|
| **R2** | Persistent markdown file storage for all agent workspaces | S3-compatible HTTP API (custom client) |
| **KV** | Read-through cache for markdown files | 5-minute TTL, invalidated on write |

---

## Data Flow

### Chat Request Flow

```
Client → POST /api/chat/:agentId
  ↓
ingressRouter (auth check)
  ↓
LeadWorkflow.processUserRequest()
  ├── workspaceHydrator.hydrate()      // Fetch .md files from R2 (via KV cache)
  ├── fileConcatenator.concatenate()   // Stitch into system prompt
  ├── tokenEstimator.estimate()        // Check token budget
  ├── provider.complete()              // LLM call (OpenAI/Anthropic)
  │   ├── [Tool call detected]
  │   │   ├── mcpClient.discoverTools()
  │   │   ├── schemaTranslator.translate()   // MCP → LLM format
  │   │   ├── mcpClient.executeTool()
  │   │   └── provider.complete()            // Synthesis call
  │   └── [No tool call] → direct response
  ├── deferredFlusher.schedule()       // Background memory write
  ├── executionTracer.record()         // Trace logging
  └── Response (JSON or SSE stream)
```

### MCP Tool Discovery Flow

```
Client → POST /api/mcp/discover
  ↓
sseConsumer.connect(url)              // SSE connection to MCP server
  ↓
jsonRpcParser.parse(stream)           // Parse incoming JSON-RPC messages
  ↓
schemaTranslator.discoverTools()      // Extract tool definitions
  ↓
schemaTranslator.translate()          // Convert to OpenAI/Anthropic format
  ↓
Response: { tools: [...], serverInfo: {...} }
```

### Telegram Webhook Flow

```
Telegram → POST /webhook/telegram
  ↓
webhookHandler.route(payload)
  ├── /start → send welcome message
  ├── /help  → send help message
  └── /chat <message>
      ├── messageParser.parse()       // Extract text, commands
      ├── SubAgentWorkflow.processMessage()
      └── apiClient.sendMessage()     // Reply via Telegram Bot API
```

---

## Package Design

### `@midas/contracts`
- **Purpose**: Single source of truth for all data structures
- **Key exports**: Branded types (`AgentId`, `WorkspaceId`), Zod schemas for every API payload, error class hierarchy
- **Design**: Zero runtime dependencies (Zod only)
- **Usage**: Imported by every other package and the edge hub

### `@midas/compiler`
- **Purpose**: Compile markdown workspaces into LLM-ready prompts
- **Components**:
  - `FileConcatenator` — stitches files in canonical order (soul → identity → user → memory → tools)
  - `TokenEstimator` — heuristic ~4 chars/token + 10% safety margin
  - `DiffGenerator` — LCS-based line diff with reasoning annotations
  - `PromptBuilder` — assembles compiled prompt + tool definitions
- **Design**: Pure functions, zero dependencies, testable

### `@midas/vfs`
- **Purpose**: Virtual File System abstraction over R2
- **Components**:
  - `S3FetchClient` — raw HTTP S3 client (no AWS SDK), uses Web Fetch API + XML regex parsing
  - `KVCacheManager` — read-through cache with TTL, getOrFetch pattern
  - `WorkspaceHydrator` — concurrent multi-file fetch, optional cache pass-through
  - `DeferredFlusher` — background write queue using `ctx.waitUntil()`
- **Design**: All components accept `env` bindings, no global state

### `@midas/mcp-edge`
- **Purpose**: Edge-native MCP transport layer
- **Components**:
  - `SSEConsumer` — async generator for SSE streams (ReadableStream-based)
  - `JsonRpcParser` — JSON-RPC 2.0 message parser/builder
  - `SchemaTranslator` — MCP → OpenAI/Anthropic tool schema converters
  - `MCPClient` — high-level discover + execute interface
  - `SSEKeepAlive` — heartbeat monitor with health states
  - `TimeoutController` — AbortSignal timeout wrapper
- **Design**: Pure Web APIs only, no EventSource dependency

### `@midas/ai-provider`
- **Purpose**: LLM provider abstraction
- **Components**:
  - `AIProvider` interface — `complete()`, `streamComplete()`
  - `OpenAIProvider` — fetch-based client, SSE streaming, tool calls
  - `AnthropicProvider` — fetch-based client, tool_use blocks, streaming
  - `ProviderFactory` — auto-detect from available API keys
- **Design**: Easy to add new providers (implement interface)

---

## Security Model

### Agent Isolation

```
Lead Agent
  ├── Can READ/WRITE: all workspaces (agents/*/)
  ├── Can SPAWN: new sub-agents
  ├── Can MODIFY: any sub-agent file
  └── System tools: modify_sub_agent, spawn_sub_agent

Sub-Agent
  ├── Can READ/WRITE: own workspace only (agents/<id>/)
  ├── Can USE: tools defined in own tools.md
  └── NO system-level tools
```

### Path Traversal Protection

All file operations validate paths against `./agents/<agentId>/files/` prefix. Attempts to access `../` segments are rejected with `PathTraversalError`.

### Auth Layer

- Session tokens are Base64-encoded (production should use JWT)
- Telegram webhook verified by bot token match
- CORS restricted to known origins (localhost, pages.dev)
- No public write endpoints without auth

---

## Edge Compatibility

All packages are designed for Cloudflare Workers:

| Package | Web API | Node.js API | Notes |
|---------|---------|-------------|-------|
| `@midas/contracts` | Yes | None | Pure types + Zod |
| `@midas/compiler` | Yes | None | Pure functions |
| `@midas/vfs` | Yes | None | S3 via `fetch()` |
| `@midas/mcp-edge` | Yes | None | SSE via `ReadableStream` |
| `@midas/ai-provider` | Yes | None | LLM via `fetch()` |
| `@midas/ui-shared` | Yes | None | Browser-safe utilities |

---

## Observability

- **Traces**: `ExecutionTracer` creates structured trace nodes (user_request, lead_analysis, sub_agent_assignment, mcp_tool_execution, lead_synthesis, error, system_action)
- **Logging**: Structured JSON via `console.warn` / `console.error`
- **Cloudflare Observability**: Enabled with 100% head sampling rate
- **Diffs**: All file writes generate LCS-based diffs recorded in trace log
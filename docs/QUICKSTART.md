# Quickstart Guide

> Get Multi-Agent Hub running locally in under 5 minutes.

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Wrangler CLI** (included via workspace)
- **API Key** from OpenAI and/or Anthropic

## 1. Install & Setup

```bash
# Clone the repository
git clone <repo-url> multi-agent-hub
cd multi-agent-hub

# Install all dependencies
pnpm install

# Copy environment variables for local development
cp .dev.vars.example apps/edge-hub/.dev.vars

# Edit the file with your API keys
# Minimum required: at least one of OPENAI_API_KEY or ANTHROPIC_API_KEY
```

**Required `.dev.vars` configuration:**

```ini
# AI Provider (at least one required)
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Session secret for Web UI auth
SESSION_SECRET=dev-session-secret-change-in-production
```

## 2. Start Development Servers

### Terminal 1 — Edge Hub (Cloudflare Worker)

```bash
pnpm --filter @midas/edge-hub dev
```

The worker starts at `http://localhost:8787`.

### Terminal 2 — Web UI (React + Vite)

```bash
pnpm --filter @midas/web-ui dev
```

The dashboard starts at `http://localhost:5173`.

### Terminal 3 — Mock MCP Server (optional, for testing tools)

```bash
pnpm --filter @midas/mock-mcp-server dev
```

The mock server starts at `http://localhost:3001`.

### All at once (using Turborepo)

```bash
pnpm dev
```

This starts all apps in parallel with Turborepo.

## 3. Verify It Works

```bash
# Health check
curl http://localhost:8787/health
# Expected: { "ok": true, "version": "..." }

# Health check from Web UI
# Open http://localhost:5173 — you should see the dashboard
```

## 4. Configure MCP Tools

Add MCP server URLs to your environment:

```ini
# .dev.vars
MCP_SERVER_URLS=http://localhost:3001/sse,https://your-mcp-server.com/sse
```

Then discover tools via the API:

```bash
curl -X POST http://localhost:8787/api/mcp/discover \
  -H "Content-Type: application/json" \
  -d '{"serverUrl": "http://localhost:3001/sse"}'
```

## 5. Create Your First Agent

```bash
# Spawn a new sub-agent
curl -X POST http://localhost:8787/api/agents \
  -H "Authorization: Bearer $(echo -n 'admin:dashboard' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "my-first-agent",
    "soul": "You are a helpful coding assistant with a friendly tone.",
    "identity": "Role: coding mentor\nExpertise: TypeScript, React, Cloudflare"
  }'
```

## 6. Start Chatting

```bash
curl -X POST http://localhost:8787/api/chat/my-first-agent \
  -H "Authorization: Bearer $(echo -n 'admin:dashboard' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello! What can you help me with?"}'
```

## 7. Run the Test Suite

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm --filter @midas/edge-hub test -- --coverage

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## What's Next?

- Read the [Architecture Guide](./ARCHITECTURE.md) for a deep-dive into the system
- Check the [Deploy Guide](./DEPLOY_GUIDE.md) for production deployment
- Review the [Production Checklist](./PRODUCTION_CHECKLIST.md) before going live
- Explore the [API Reference](./API_REFERENCE.md) for all available endpoints
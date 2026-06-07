# Deploy Guide

> Instructions for deploying Multi-Agent Hub to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Cloudflare Setup](#cloudflare-setup)
- [Deploy Edge Hub (Worker)](#deploy-edge-hub-worker)
- [Deploy Web UI (Pages)](#deploy-web-ui-pages)
- [Deploy Native App](#deploy-native-app)
- [Telegram Bot Setup](#telegram-bot-setup)
- [Environment Management](#environment-management)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring](#monitoring)
- [Rollback](#rollback)

---

## Prerequisites

- **Cloudflare account** with Workers and Pages enabled
- **R2 bucket** created for workspace storage
- **KV namespace** for VFS cache
- **API keys** for OpenAI and/or Anthropic
- **Node.js** >= 20, **pnpm** >= 9

## Cloudflare Setup

### 1. Install Wrangler & Authenticate

```bash
# Wrangler is already in the project's devDependencies
cd apps/edge-hub

# Authenticate with Cloudflare
npx wrangler login
# Opens browser — authorize the CLI
```

### 2. Create KV Namespace

```bash
cd apps/edge-hub
npx wrangler kv:namespace create VFS_CACHE
```

Copy the returned `id` into `apps/edge-hub/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "VFS_CACHE"
id = "your-kv-namespace-id"  # ← Paste here
```

### 3. Create R2 Bucket

```bash
npx wrangler r2 bucket create midas-workspaces
```

### 4. Generate TypeScript Types

```bash
npx wrangler types
```

This generates `worker-configuration.d.ts` with the correct `Env` interface based on your `wrangler.toml`.

---

## Deploy Edge Hub (Worker)

### Initial Deploy

```bash
# From project root
cd apps/edge-hub

# Set production secrets
echo "sk-your-openai-key" | npx wrangler secret put OPENAI_API_KEY
echo "sk-ant-your-anthropic-key" | npx wrangler secret put ANTHROPIC_API_KEY
echo "your-session-secret" | npx wrangler secret put SESSION_SECRET
echo "your-telegram-bot-token" | npx wrangler secret put TELEGRAM_BOT_TOKEN

# Deploy
npx wrangler deploy
```

### Verify Deployment

```bash
# Health check
curl https://multi-agent-hub.your-account.workers.dev/health
# Expected: { "ok": true, "version": "0.1.0" }
```

### Deploy with Environment

If using environments (staging/production):

```toml
# wrangler.toml
[env.staging]
name = "multi-agent-hub-staging"
vars = { ENVIRONMENT = "staging" }

[env.production]
name = "multi-agent-hub"
vars = { ENVIRONMENT = "production" }
```

```bash
# Deploy to staging
npx wrangler deploy --env staging

# Promote to production
npx wrangler deploy --env production
```

---

## Deploy Web UI (Pages)

### Build & Deploy

```bash
cd apps/web-ui

# Build for production
pnpm build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name multi-agent-hub
```

### Custom Domain

1. Go to Cloudflare Dashboard → **Workers & Pages** → **multi-agent-hub**
2. Navigate to **Custom domains** → **Add custom domain**
3. Enter your domain (e.g., `dashboard.your-domain.com`)

### Environment Variables for Web UI

```bash
# Set production variables
npx wrangler pages secret put SESSION_SECRET --project-name multi-agent-hub
npx wrangler pages secret put VITE_API_URL --project-name multi-agent-hub
```

---

## Deploy Native App

### Prerequisites

- **Expo account** (sign up at [expo.dev](https://expo.dev))
- **EAS CLI** installed (`npm install -g eas-cli`)
- **iOS**: Apple Developer account (for TestFlight/App Store)
- **Android**: Google Play Console account

### EAS Build & Submit

```bash
cd apps/native

# Login to Expo
eas login

# Configure builds
eas build:configure

# Build for production
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### OTA Updates

```bash
# Push updates without rebuilding
eas update --branch production --message "Fix: chat input handling"
```

---

## Telegram Bot Setup

### 1. Create Bot

Talk to [@BotFather](https://t.me/BotFather) on Telegram:

```
/newbot
YourBotName
your_bot_username
```

Save the bot token.

### 2. Set Webhook

```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://multi-agent-hub.your-account.workers.dev/webhook/telegram"
  }'
```

### 3. Verify Webhook

```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

---

## Environment Management

### Production Secrets (all via wrangler)

```bash
# Interactive prompts — recommended
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put SESSION_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN

# Bulk from JSON file
npx wrangler secret bulk ./secrets.json
```

### Environment-Specific Variables

In `wrangler.toml`:

```toml
[vars]
ENVIRONMENT = "production"
LOG_LEVEL = "info"

[env.staging]
vars = { ENVIRONMENT = "staging", LOG_LEVEL = "debug" }
```

---

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) handles:

1. **Quality Checks** (every push/PR to main):
   - Install dependencies (`pnpm install --frozen-lockfile`)
   - TypeScript type check (`pnpm typecheck`)
   - ESLint (`pnpm lint`)
   - Vitest tests (`pnpm test`)
   - Build all packages (`pnpm build`)

2. **Deploy Edge Worker** (on push to main):
   - Runs after quality checks pass
   - Deploys to Cloudflare Workers via `pnpm deploy:edge`

3. **Deploy Web UI** (on push to main):
   - Runs after quality checks pass
   - Builds web UI and deploys to Cloudflare Pages

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers + Pages permissions |

### Concurrency Settings

The workflow uses `concurrency` to cancel redundant runs:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

---

## Monitoring

### Live Logs

```bash
npx wrangler tail
```

### Observability Dashboard

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Select your worker → **Observability** tab
3. View: invocations, errors, duration, CPU time

### Custom Metrics

Structured logging via `console.warn`/`console.error`:

```typescript
console.warn(JSON.stringify({
  event: 'chat_completion',
  agentId: agentId,
  duration: elapsed,
  tokens: tokenCount,
  success: true
}));
```

These appear in `wrangler tail` and Cloudflare Observability.

---

## Rollback

### Workers

```bash
# List recent versions
npx wrangler deployments

# Rollback to specific version
npx wrangler rollback --version <deployment-id>
```

### Pages

1. **Cloudflare Dashboard** → **Workers & Pages** → **multi-agent-hub**
2. Go to **Deployments** tab
3. Find the deployment to roll back to
4. Click **...** → **Rollback to this deployment**

### KV Cache Reset

```bash
# Clear the entire KV namespace
npx wrangler kv:key list VFS_CACHE | jq -r '.[].name' | xargs -I{} npx wrangler kv:key delete {} --binding VFS_CACHE
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `bindings` error on deploy | Run `npx wrangler types` to regenerate type definitions |
| KV namespace not found | Create namespace and update `id` in `wrangler.toml` |
| Deploy rejected (outdated compatibility_date) | Update `compatibility_date` to current date |
| CORS errors in browser | Check CORS origins in `apps/edge-hub/src/index.ts` |
| `wrangler deploy` missing env | Use `--env staging` for environment-specific deploys |
| `wrangler pages deploy` fails | Ensure build output directory exists (`dist/` for web-ui) |

### Getting Help

- [Cloudflare Workers docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI reference](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare MCP servers](https://mcp.cloudflare.com/) (ask docs via AI)
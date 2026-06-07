# Production Checklist

> Pre-flight checklist for deploying Multi-Agent Hub to production.

## Configuration

### wrangler.toml

- [ ] **`compatibility_date`** is set to a date within the last 30 days
- [ ] **`compatibility_flags`** includes `["nodejs_compat"]` if needed
- [ ] **KV namespace** is created and ID is set:
  ```bash
  wrangler kv:namespace create VFS_CACHE
  ```
- [ ] **R2 bucket** exists:
  ```bash
  wrangler r2 bucket create midas-workspaces
  ```
- [ ] **Observability** is enabled (already configured):
  ```toml
  [observability]
  enabled = true
  head_sampling_rate = 1.0
  ```
- [ ] **`wrangler types`** has been run after any binding change:
  ```bash
  cd apps/edge-hub && npx wrangler types
  ```

### TypeScript

- [ ] `strict: true` in tsconfig (already set)
- [ ] `noUncheckedIndexedAccess: true` (already set)
- [ ] `noUnusedLocals` and `noUnusedParameters` enabled (already set)
- [ ] No `any` types in production code (enforced by ESLint)
- [ ] No unsafe casts (`as unknown as T`) — use proper type guards
- [ ] Service bindings are typed correctly via generated `Env` interface

## Secrets & Environment

- [ ] **API keys** set via `wrangler secret put` (never in `.dev.vars` or code):
  ```bash
  wrangler secret put OPENAI_API_KEY
  wrangler secret put ANTHROPIC_API_KEY
  wrangler secret put SESSION_SECRET
  wrangler secret put TELEGRAM_BOT_TOKEN   # optional
  ```
- [ ] **No hardcoded secrets** in source code or configuration files
- [ ] **`.env` and `.dev.vars`** are in `.gitignore`
- [ ] **`SESSION_SECRET`** is a strong, randomly generated value:
  ```bash
  openssl rand -base64 32
  ```

## Security

- [ ] **Auth middleware** uses proper JWT or OAuth (not just Base64-encoded tokens)
- [ ] **Path traversal** protection is verified for all file operations
- [ ] **CORS origins** are restricted to your actual domains:
  ```typescript
  cors({
    origin: ['https://your-dashboard.pages.dev', 'https://your-custom-domain.com']
  })
  ```
- [ ] **Rate limiting** is configured on Hono routes:
  ```typescript
  import { rateLimiter } from 'hono-rate-limiter'
  ```
- [ ] **Secure headers** are applied:
  ```typescript
  app.use('*', secureHeaders())
  ```
- [ ] **Input validation** uses Zod schemas on all API routes
- [ ] **Timing-safe comparisons** for secret/API key validation (`crypto.subtle.timingSafeEqual`)

## Performance

- [ ] **KV cache TTL** is tuned for your use case (default: 5 minutes)
- [ ] **Token budget** is configured per agent to prevent LLM overruns
- [ ] **SSE keep-alive** is configured with reasonable timeouts
- [ ] **Streaming responses** used for large LLM outputs (not buffered entirely in memory)
- [ ] **`ctx.waitUntil()`** properly handles all background operations
- [ ] **No floating promises** — every Promise is awaited, returned, voided, or passed to waitUntil
- [ ] **`wrangler check startup`** profiled to ensure fast cold starts:
  ```bash
  npx wrangler check startup apps/edge-hub/src/index.ts
  ```

## Reliability

- [ ] **Error boundaries** in web UI (`ErrorBoundary` component)
- [ ] **Global error handler** returns structured error responses (not stack traces):
  ```json
  { "error": { "code": "FILE_NOT_FOUND", "message": "..." } }
  ```
- [ ] **Retry logic** on MCP connections with exponential backoff
- [ ] **Timeout controllers** on all external API calls (LLM, MCP, S3)
- [ ] **Health check endpoint** returns `{ ok: true, version: "..." }`
- [ ] **Deploy dry-run** before actual deployment:
  ```bash
  wrangler deploy --dry-run
  ```

## Monitoring & Observability

- [ ] **Structured logging** (JSON format) for all API requests and errors
- [ ] **Execution tracing** enabled with appropriate sampling rate
- [ ] **Cloudflare Observability** tail set up:
  ```bash
  wrangler tail
  ```
- [ ] **Error tracking** integrated (e.g., Sentry for Workers, or custom analytics)
- [ ] **Alerts** configured for error rate spikes and latency degradation

## CI/CD

- [ ] **GitHub Actions** workflow runs quality checks on every PR:
  - Type check (`tsc --noEmit`)
  - Lint (ESLint)
  - Test (Vitest)
  - Build
- [ ] **Deployment jobs** have proper environment-specific configuration:
  ```yaml
  - name: Deploy to Cloudflare Workers
    run: pnpm deploy:edge
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  ```
- [ ] **`wrangler types --check`** included in CI to catch binding type drift
- [ ] **Deploy staging** branch for pre-production validation
- [ ] **Rollback plan** documented:
  ```bash
  wrangler rollback
  ```

## Testing

- [ ] **Unit tests** pass for all packages:
  ```bash
  pnpm test
  ```
- [ ] **Integration tests** with `@cloudflare/vitest-pool-workers` for Workers runtime
- [ ] **Token estimator** tested with representative prompt sizes
- [ ] **Diff generator** tested with various file change patterns
- [ ] **MCP client** tested with timeout, disconnect, and error scenarios
- [ ] **Path traversal** tested with malicious input patterns
- [ ] **SSE streaming** tested with large responses

## Documentation

- [ ] **`compatibility_date`** documented for quarterly updates
- [ ] **Environment variables** documented in `.env.example`
- [ ] **API endpoints** documented in [API Reference](./API_REFERENCE.md)
- [ ] **Deploy steps** documented in [Deploy Guide](./DEPLOY_GUIDE.md)
- [ ] **Architecture decisions** documented in [Architecture Guide](./ARCHITECTURE.md)

## Final Checks

- [ ] No `TODO` or `FIXME` comments in production code paths
- [ ] `pnpm build` succeeds with zero errors
- [ ] `pnpm lint` passes with zero warnings
- [ ] `pnpm test` passes with full coverage
- [ ] Web UI builds successfully
- [ ] Native app builds successfully (if deploying)
- [ ] Deploy dry-run succeeds
- [ ] CORS origins are correct for production domains
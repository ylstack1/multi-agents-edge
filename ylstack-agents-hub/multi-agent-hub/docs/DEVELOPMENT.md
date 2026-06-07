# Development Guide

> Guidelines and workflows for contributing to Multi-Agent Hub.

## Table of Contents

- [Development Environment](#development-environment)
- [Project Scripts](#project-scripts)
- [Package Conventions](#package-conventions)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Adding Features](#adding-features)
- [Troubleshooting](#troubleshooting)

---

## Development Environment

### Recommended Setup

- **Editor**: VS Code or Cursor (with TypeScript, ESLint, Prettier extensions)
- **Terminal**: iTerm2, Warp, or any modern terminal
- **Cloudflare**: Wrangler CLI authenticated via `npx wrangler login`

### Local Dev Dependencies

```bash
# Verify prerequisites
node --version  # >= 20.0.0
pnpm --version  # >= 9.0.0
```

### Quick Start

```bash
git clone <repo-url>
cd multi-agent-hub
pnpm install
cp .dev.vars.example apps/edge-hub/.dev.vars
# Edit .dev.vars with your API keys
pnpm dev
```

---

## Project Scripts

### Root `package.json`

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `turbo dev` | Start all apps in dev mode |
| `build` | `turbo build` | Build all packages and apps |
| `test` | `turbo test` | Run all tests |
| `lint` | `turbo lint` | Run ESLint across all packages |
| `typecheck` | `turbo typecheck` | TypeScript type checking |
| `clean` | `turbo clean` | Remove all build artifacts |
| `format` | Prettier | Format all source files |
| `format:check` | Prettier | Check formatting without changes |
| `deploy:edge` | wrangler | Deploy Edge Hub to Workers |
| `deploy:web` | vite + wrangler | Deploy Web UI to Pages |
| `deploy:native` | eas | Deploy native app update |
| `ci` | Combined | Full CI pipeline: lint → typecheck → test |

### Per-App Scripts

```bash
# Edge Hub (apps/edge-hub)
pnpm --filter @midas/edge-hub dev          # Start Hono dev server
pnpm --filter @midas/edge-hub deploy       # Deploy to Cloudflare Workers
pnpm --filter @midas/edge-hub test         # Run edge hub tests
pnpm --filter @midas/edge-hub test:watch   # Tests in watch mode

# Web UI (apps/web-ui)
pnpm --filter @midas/web-ui dev            # Start Vite dev server
pnpm --filter @midas/web-ui build          # Production build
pnpm --filter @midas/web-ui preview        # Preview production build

# Native App (apps/native)
pnpm --filter @midas/native dev            # Start Expo dev server
pnpm --filter @midas/native build          # EAS build

# Packages (test, lint, typecheck)
pnpm --filter @midas/contracts test
pnpm --filter @midas/compiler test
pnpm --filter @midas/vfs test
pnpm --filter @midas/mcp-edge test
pnpm --filter @midas/ai-provider test
```

---

## Package Conventions

### Naming

- **Package name**: `@midas/<name>` (e.g., `@midas/contracts`)
- **Directory**: `packages/<name>` or `apps/<name>`
- **Exports**: Defined in `package.json` `"exports"` field (ESM)
- **Entry**: `src/index.ts` (re-exports public API)

### Monorepo Conventions

- **Shared config**: `tsconfig.base.json` at root — all packages extend it
- **No circular dependencies**: Packages import from `@midas/contracts` but not vice versa
- **Dependency graph**: `contracts` → `compiler`, `vfs`, `mcp-edge`, `ai-provider` → `edge-hub`
- **New packages**: Create in `packages/`, add `"@midas/<name>": "workspace:*"` to consumers
- **TypeScript**: `composite: true` + `incremental: true` for fast rebuilds

### Export Pattern

```typescript
// src/index.ts — barrel export
export { AgentId, WorkspaceId } from './identifiers.js';
export { AgentHubError, WorkspaceNotFoundError } from './errors.js';
export { agentWorkspaceSchema, llmMessageSchema } from './payloads.js';

// Individual modules import directly from source
// Consumers import from package name
import { AgentId } from '@midas/contracts';
```

### Testing Conventions

- **File placement**: `tests/*.test.ts` inside each package/app
- **Coverage target**:
  - Packages: 90%+ (pure logic, easy to test)
  - Edge hub: 80%+ (integration-heavy)
  - Web UI: 70%+ (UI components)
  - Native: 60%+ (platform-specific)
- **Naming**: `describe('ModuleName')` / `it('should do X')`
- **Vitest config**: Each package has its own `vitest.config.ts` extending the workspace

---

## Testing

### Running Tests

```bash
# All tests
pnpm test

# Specific package (watch mode)
pnpm --filter @midas/mcp-edge test:watch

# With coverage
pnpm --filter @midas/compiler test -- --coverage

# E2E / integration (if configured)
pnpm --filter @midas/edge-hub test:integration
```

### Writing Tests

```typescript
// packages/compiler/tests/token-estimator.test.ts
import { describe, it, expect } from 'vitest';
import { estimateTokens } from '../src/token-estimator.js';

describe('TokenEstimator', () => {
  it('estimates tokens for a given text', () => {
    expect(estimateTokens('hello world')).toBe(3); // 12 chars / 4 = 3
  });

  it('applies safety margin', () => {
    const result = estimateTokens('a'.repeat(100));
    expect(result).toBe(28); // 100/4 = 25 * 1.1 = 27.5 → 28
  });

  it('handles empty strings', () => {
    expect(estimateTokens('')).toBe(0);
  });
});
```

### Mocking Cloudflare Bindings

For packages that interact with Cloudflare:

```typescript
// Create mock bindings for tests
const mockEnv = {
  VFS_CACHE: {
    get: async (key: string) => null,
    put: async (key: string, value: string) => {},
  },
  WORKSPACE_BUCKET: {
    get: async (key: string) => null,
    put: async (key: string, value: ReadableStream) => {},
  },
};
```

---

## Code Quality

### TypeScript

- **strict: true** — all strict checks enabled
- **noUncheckedIndexedAccess** — forces explicit undefined checks on array/object access
- **noUnusedLocals/Parameters** — no dead code
- **ES2022 target** — modern JavaScript features
- **No `any`** — use `unknown` + type guards instead

### ESLint

```bash
pnpm lint                    # Check all files
pnpm lint -- --fix          # Auto-fix issues
```

Rules enforced:
- No `console.log` (allow `warn`/`error`)
- No explicit `any` (warn)
- TypeScript strict mode enforcement
- Import ordering (via Perfectionist plugin)

### Formatting

```bash
pnpm format                  # Format all files
pnpm format:check           # Check without changing
```

Prettier with:
- `semi: true`
- `singleQuote: true`
- `trailingComma: all`
- `printWidth: 100`
- `tabWidth: 2`
- Tailwind CSS class sorting (plugin)

---

## Adding Features

### New API Route

1. Create handler file: `apps/edge-hub/src/routes/<feature>.ts`
2. Export Hono route handler
3. Register in `apps/edge-hub/src/index.ts`:
   ```typescript
   import { featureRoutes } from './routes/feature.js';
   app.route('/api/feature', featureRoutes);
   ```
4. Add Zod schemas in `packages/contracts/src/payloads.ts`
5. Add tests in `apps/edge-hub/tests/`

### New Package

1. Create directory: `packages/<name>/`
2. Add `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`
3. Add to `pnpm-workspace.yaml`
4. Add dependency in consumer's `package.json`: `"@midas/<name>": "workspace:*"`
5. Run `pnpm install` at root

### New AI Provider

1. Implement `AIProvider` interface in `packages/ai-provider/src/`
2. Add factory support in `provider-factory.ts`
3. Add Zod schemas if new config params are needed (in `@midas/contracts`)
4. Add tests

### New MCP Transport

1. Extend `packages/mcp-edge/src/` with new transport (e.g., WebSocket)
2. Implement connect/discover/execute pattern
3. Add timeout and keep-alive support

### New Client Surface

1. Create directory: `apps/<new-client>/`
2. Use the REST API at `http://localhost:8787/api/*`
3. Add to `pnpm-workspace.yaml` and Turborepo pipeline

---

## Troubleshooting

### Common Issues

#### `pnpm install` fails

```bash
# Clear pnpm store and retry
pnpm store prune
rm -rf node_modules
pnpm install
```

#### `wrangler dev` fails to start

```bash
# Ensure .dev.vars exists
ls apps/edge-hub/.dev.vars

# Check wrangler.toml for valid KV/R2 bindings
# For local dev, KV/R2 can be simulated

# Try starting with verbose logging
pnpm --filter @midas/edge-hub dev -- --verbose
```

#### TypeScript errors after pulling

```bash
# Rebuild TypeScript project references
pnpm build
```

#### Tests failing

```bash
# Clear build artifacts and retry
pnpm clean
pnpm build
pnpm test
```

#### Port already in use

```bash
# Find what's on port 8787
lsof -i :8787

# Kill the process
kill -9 <PID>

# Or use a different port
# Edit apps/edge-hub/package.json dev script or wrangler.toml
```

### Getting Help

- Consult the [Architecture Guide](./ARCHITECTURE.md) for system design details
- Review the [API Reference](./API_REFERENCE.md) for endpoint specifications
- Check the [Deploy Guide](./DEPLOY_GUIDE.md) for deployment issues
- File issues in the project repository
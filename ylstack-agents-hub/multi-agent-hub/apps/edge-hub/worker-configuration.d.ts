export interface Env {
  // Assets binding for static file serving (web UI)
  ASSETS: Fetcher;

  // S3-compatible R2 bucket for workspace files
  WORKSPACE_BUCKET: R2Bucket;

  // KV cache for read-through caching and settings storage
  VFS_CACHE: KVNamespace;

  // Workers AI binding (default provider, no API key needed)
  AI: Ai;

  // Legacy AI Provider Keys (override-able via settings UI)
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;

  // Session secret for Web UI auth
  SESSION_SECRET?: string;

  // Telegram (optional — settings UI is the primary config method)
  TELEGRAM_BOT_TOKEN?: string;

  // Public base URL for webhook callbacks (set via settings UI)
  WEBHOOK_BASE_URL?: string;
}

export type { Env as WorkerEnv };
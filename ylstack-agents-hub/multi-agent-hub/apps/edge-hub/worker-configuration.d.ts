interface Env {
  // S3-compatible R2 bucket for workspace files
  WORKSPACE_BUCKET: R2Bucket;

  // KV cache for read-through caching
  VFS_CACHE: KVNamespace;

  // AI Provider Keys
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;

  // Session secret for Web UI auth
  SESSION_SECRET?: string;

  // Telegram (optional)
  TELEGRAM_BOT_TOKEN?: string;
}
import type { MarkdownFileName } from '@midas/contracts';

export interface KVBinding {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CacheConfig {
  defaultTtlSeconds: number;
  keyPrefix: string;
}

/**
 * Read-through KV cache for markdown workspace files.
 * Reduces R2 fetch latency for hot workspaces.
 */
export class KVCacheManager {
  private kv: KVBinding;
  private config: CacheConfig;

  constructor(kv: KVBinding, config: Partial<CacheConfig> = {}) {
    this.kv = kv;
    this.config = {
      defaultTtlSeconds: config.defaultTtlSeconds ?? 300, // 5 min default
      keyPrefix: config.keyPrefix ?? 'vfs:',
    };
  }

  private cacheKey(agentId: string, fileName: string): string {
    return `${this.config.keyPrefix}${agentId}:${fileName}`;
  }

  async get(agentId: string, fileName: MarkdownFileName): Promise<string | null> {
    return this.kv.get(this.cacheKey(agentId, fileName));
  }

  async set(
    agentId: string,
    fileName: MarkdownFileName,
    content: string,
    ttlSeconds?: number,
  ): Promise<void> {
    await this.kv.put(this.cacheKey(agentId, fileName), content, {
      expirationTtl: ttlSeconds ?? this.config.defaultTtlSeconds,
    });
  }

  async invalidate(agentId: string, fileName: MarkdownFileName): Promise<void> {
    await this.kv.delete(this.cacheKey(agentId, fileName));
  }

  async invalidateWorkspace(agentId: string): Promise<void> {
    // Note: KV doesn't support prefix deletion natively.
    // This is best-effort; the full R2 fetch will repopulate cache.
    const fileNames: MarkdownFileName[] = [
      'soul.md', 'identity.md', 'user.md', 'memory.md', 'tools.md',
    ];
    await Promise.allSettled(
      fileNames.map((fn) => this.invalidate(agentId, fn)),
    );
  }

  async getOrFetch(
    agentId: string,
    fileName: MarkdownFileName,
    fetcher: () => Promise<string | null>,
  ): Promise<string | null> {
    const cached = await this.get(agentId, fileName);
    if (cached !== null) return cached;

    const content = await fetcher();
    if (content !== null) {
      await this.set(agentId, fileName, content);
    }
    return content;
  }
}
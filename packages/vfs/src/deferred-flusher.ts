import type { MarkdownFileName } from '@midas/contracts';
import { S3FetchClient } from './s3-fetch-client.js';
import { KVCacheManager } from './kv-cache-manager.js';

export interface WaitUntilBinding {
  (promise: Promise<unknown>): void;
}

export interface FlushOperation {
  agentId: string;
  fileName: MarkdownFileName;
  content: string;
  timestamp: number;
}

/**
 * Manages background flush operations using ctx.waitUntil().
 * Decouples memory writes from the HTTP response loop.
 */
export class DeferredFlusher {
  private s3: S3FetchClient;
  private cache?: KVCacheManager;
  private pendingOps: FlushOperation[] = [];

  constructor(s3: S3FetchClient, cache?: KVCacheManager) {
    this.s3 = s3;
    this.cache = cache;
  }

  /**
   * Queue a flush operation to be dispatched asynchronously.
   */
  queue(agentId: string, fileName: MarkdownFileName, content: string): void {
    this.pendingOps.push({
      agentId,
      fileName,
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * How many operations are currently queued.
   */
  get queueLength(): number {
    return this.pendingOps.length;
  }

  /**
   * Execute all queued flushes and return a promise.
   * Used with ctx.waitUntil() for background execution.
   */
  async flushAll(): Promise<FlushOperation[]> {
    const ops = [...this.pendingOps];
    this.pendingOps = [];

    if (ops.length === 0) return [];

    const results = await Promise.allSettled(
      ops.map((op) => this.executeFlush(op)),
    );

    const successful: FlushOperation[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const op = ops[i];
      if (!op) continue;
      if (result && result.status === 'fulfilled') {
        successful.push(op);
      } else {
        console.error(`Deferred flush failed for ${op.agentId}/${op.fileName}:`, result?.reason);
      }
    }

    return successful;
  }

  /**
   * Convenience: queue + schedule flush via waitUntil.
   */
  scheduleFlush(
    waitUntil: WaitUntilBinding,
    agentId: string,
    fileName: MarkdownFileName,
    content: string,
  ): void {
    this.queue(agentId, fileName, content);
    waitUntil(this.flushAll());
  }

  private async executeFlush(op: FlushOperation): Promise<void> {
    await this.s3.putObject(op.agentId, op.fileName, op.content);

    if (this.cache) {
      await this.cache.set(op.agentId, op.fileName, op.content);
    }
  }
}
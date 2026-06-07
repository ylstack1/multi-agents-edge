import type { StorageBackend } from '@midas/vfs';
import { WorkspaceHydrator, KVCacheManager } from '@midas/vfs';
import type { Env } from '../worker-configuration.d.ts';

/**
 * Adapter that wraps a Cloudflare Workers R2 bucket binding
 * to match the StorageBackend interface used by WorkspaceHydrator.
 */
export class R2BucketAdapter implements StorageBackend {
  private bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  async getObject(
    agentId: string,
    fileName: string,
  ): Promise<{ content: string | null; lastModified?: string }> {
    const key = `${agentId}/${fileName}`;
    try {
      const object = await this.bucket.get(key);
      if (!object) return { content: null };
      return {
        content: await object.text(),
        lastModified: object.uploaded?.toISOString(),
      };
    } catch (err) {
      throw new Error(`Failed to fetch r2://${key}: ${err}`);
    }
  }

  async putObject(agentId: string, fileName: string, content: string): Promise<void> {
    const key = `${agentId}/${fileName}`;
    await this.bucket.put(key, content, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    });
  }

  async deleteObject(agentId: string, fileName: string): Promise<void> {
    const key = `${agentId}/${fileName}`;
    await this.bucket.delete(key);
  }

  async listObjects(prefix: string): Promise<string[]> {
    const objects = await this.bucket.list({ prefix });
    return objects.objects.map((o) => o.key);
  }
}

/**
 * Create a WorkspaceHydrator using the Worker's R2 bucket binding.
 */
export function createHydrator(env: Env) {
  const storage = new R2BucketAdapter(env.WORKSPACE_BUCKET);
  const cache = new KVCacheManager(env.VFS_CACHE);
  return new WorkspaceHydrator({ s3: storage, cache });
}
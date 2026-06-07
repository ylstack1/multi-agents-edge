import type { MarkdownFileName } from '@midas/contracts';
import type { VFSConfig, Fetcher, StorageBackend } from './types.js';

/**
 * Pure HTTP S3-compatible client using only Web Fetch and crypto.subtle.
 * No Node.js SDK dependencies. Safe for V8 isolates.
 */
export class S3FetchClient implements StorageBackend {
  private config: VFSConfig;
  private fetch: Fetcher;

  constructor(config: VFSConfig, fetcher: Fetcher = globalThis.fetch.bind(globalThis)) {
    this.config = config;
    this.fetch = fetcher;
  }

  async getObject(agentId: string, fileName: string): Promise<{ content: string | null; lastModified?: string }> {
    const encodedKey = encodeURIComponent(`${agentId}/${fileName}`);
    const url = `${this.config.r2Endpoint}/${this.config.r2Bucket}/${encodedKey}`;

    try {
      const response = await this.fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/plain',
        },
      });

      if (response.status === 404) {
        return { content: null };
      }

      if (!response.ok) {
        throw new Error(`S3 fetch failed: ${response.status} ${response.statusText}`);
      }

      return {
        content: await response.text(),
        lastModified: response.headers.get('Last-Modified') ?? undefined,
      };
    } catch (err) {
      throw new Error(`Failed to fetch s3://${this.config.r2Bucket}/${agentId}/${fileName}: ${err}`);
    }
  }

  async putObject(agentId: string, fileName: string, content: string): Promise<void> {
    const encodedKey = encodeURIComponent(`${agentId}/${fileName}`);
    const url = `${this.config.r2Endpoint}/${this.config.r2Bucket}/${encodedKey}`;

    const response = await this.fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
      },
      body: content,
    });

    if (!response.ok) {
      throw new Error(`S3 put failed: ${response.status} ${response.statusText}`);
    }
  }

  async deleteObject(agentId: string, fileName: string): Promise<void> {
    const encodedKey = encodeURIComponent(`${agentId}/${fileName}`);
    const url = `${this.config.r2Endpoint}/${this.config.r2Bucket}/${encodedKey}`;

    const response = await this.fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`S3 delete failed: ${response.status} ${response.statusText}`);
    }
  }

  async listObjects(prefix: string): Promise<string[]> {
    const encodedPrefix = encodeURIComponent(prefix);
    const url = `${this.config.r2Endpoint}/${this.config.r2Bucket}?prefix=${encodedPrefix}`;

    const response = await this.fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/xml' },
    });

    if (!response.ok) {
      throw new Error(`S3 list failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    // Simple XML parsing for key extraction (minimal, no deps)
    const keys: string[] = [];
    const keyRegex = /<Key>([^<]+)<\/Key>/g;
    let match: RegExpExecArray | null;
    while ((match = keyRegex.exec(text)) !== null) {
      if (match[1]) keys.push(match[1]);
    }
    return keys;
  }

  async fetchFiles(
    agentId: string,
    fileNames: MarkdownFileName[],
  ): Promise<Record<string, string | null>> {
    const results = await Promise.allSettled(
      fileNames.map((fn) => this.getObject(agentId, fn)),
    );

    const files: Record<string, string | null> = {};
    fileNames.forEach((fn, idx) => {
      const result = results[idx];
      if (result && result.status === 'fulfilled') {
        files[fn] = result.value.content;
      } else {
        files[fn] = null;
      }
    });

    return files;
  }
}
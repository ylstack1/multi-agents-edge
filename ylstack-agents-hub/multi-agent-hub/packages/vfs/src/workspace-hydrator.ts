import type { AgentWorkspace, MarkdownFileName } from '@midas/contracts';
import { MARKDOWN_FILE_NAMES, isValidMarkdownFileName } from '@midas/contracts';
import type { StorageBackend } from './types.js';
import { KVCacheManager } from './kv-cache-manager.js';

export interface HydratorDeps {
  s3: StorageBackend;
  cache?: KVCacheManager;
}

/**
 * Hydrates a full AgentWorkspace by fetching all markdown files
 * concurrently from R2 with optional KV cache pass-through.
 */
export class WorkspaceHydrator {
  private deps: HydratorDeps;

  constructor(deps: HydratorDeps) {
    this.deps = deps;
  }

  async readWorkspace(agentId: string, useCache = true): Promise<AgentWorkspace> {
    const fileNames = [...MARKDOWN_FILE_NAMES];
    const files: Record<string, string | null> = {};

    const fetchPromises = fileNames.map(async (fileName) => {
      if (useCache && this.deps.cache) {
        files[fileName] = await this.deps.cache.getOrFetch(agentId, fileName, () =>
          this.deps.s3.getObject(agentId, fileName).then((r) => r.content),
        );
      } else {
        const result = await this.deps.s3.getObject(agentId, fileName);
        files[fileName] = result.content;
      }
    });

    await Promise.all(fetchPromises);

    return {
      agentId,
      files: files as AgentWorkspace['files'],
      lastModifiedEpochMs: Date.now(),
    };
  }

  async writeFile(
    agentId: string,
    fileName: MarkdownFileName,
    content: string,
  ): Promise<void> {
    if (!isValidMarkdownFileName(fileName)) {
      throw new Error(`Invalid markdown file name: ${fileName}`);
    }

    await this.deps.s3.putObject(agentId, fileName, content);

    // Invalidate cache after write
    if (this.deps.cache) {
      await this.deps.cache.invalidate(agentId, fileName);
    }
  }

  async listWorkspaces(): Promise<string[]> {
    const keys = await this.deps.s3.listObjects('');
    const agentIds = new Set<string>();
    for (const key of keys) {
      const parts = key.split('/');
      if (parts[0]) agentIds.add(parts[0]);
    }
    return [...agentIds];
  }

  async deleteWorkspace(agentId: string): Promise<void> {
    const keys = await this.deps.s3.listObjects(`${agentId}/`);
    await Promise.all(
      keys.map((key) => {
        const fileName = key.split('/')[1];
        if (fileName && isValidMarkdownFileName(fileName)) {
          return this.deps.s3.deleteObject(agentId, fileName);
        }
        return Promise.resolve();
      }),
    );

    if (this.deps.cache) {
      await this.deps.cache.invalidateWorkspace(agentId);
    }
  }
}
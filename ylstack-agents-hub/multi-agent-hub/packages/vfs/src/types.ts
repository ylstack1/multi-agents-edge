import type { MarkdownFileName } from '@midas/contracts';

export interface VFSConfig {
  r2Endpoint: string;
  r2Bucket: string;
  kvNamespace?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface VFSReadOptions {
  agentId: string;
  files?: MarkdownFileName[];
  useCache?: boolean;
}

export interface VFSWriteOptions {
  agentId: string;
  fileName: MarkdownFileName;
  content: string;
  reasoning?: string;
  flushAsync?: boolean;
}

export interface VFSWriteResult {
  success: boolean;
  agentId: string;
  fileName: string;
  sizeBytes: number;
  timestamp: number;
}

export interface VFSListResult {
  agents: Array<{
    agentId: string;
    lastModifiedEpochMs: number;
    fileCount: number;
  }>;
}

export type Fetcher = typeof fetch;

/**
 * Storage backend interface used by WorkspaceHydrator.
 * Can be implemented by S3FetchClient (HTTP S3) or R2BucketAdapter (Workers R2 binding).
 */
export interface StorageBackend {
  getObject(agentId: string, fileName: string): Promise<{ content: string | null; lastModified?: string }>;
  putObject(agentId: string, fileName: string, content: string): Promise<void>;
  deleteObject(agentId: string, fileName: string): Promise<void>;
  listObjects(prefix: string): Promise<string[]>;
}
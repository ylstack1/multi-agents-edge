import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceHydrator } from '../src/workspace-hydrator.js';
import { S3FetchClient } from '../src/s3-fetch-client.js';

describe('WorkspaceHydrator', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  function makeMockResponse(body: string, status = 200, headers?: Record<string, string>): Response {
    return new Response(body, { status, headers: { 'Content-Type': 'text/plain', ...headers } });
  }

  it('reads workspace with all files present', async () => {
    // Provide a fresh Response for each of the 5 concurrent requests
    mockFetch.mockImplementation(() =>
      Promise.resolve(makeMockResponse('# Soul content')),
    );

    const s3 = new S3FetchClient({
      r2Endpoint: 'https://test.com',
      r2Bucket: 'test-bucket',
    });
    const hydrator = new WorkspaceHydrator({ s3 });

    const workspace = await hydrator.readWorkspace('agent-1');
    expect(workspace.agentId).toBe('agent-1');
    expect(workspace.files['soul.md']).toBe('# Soul content');
    expect(workspace.lastModifiedEpochMs).toBeGreaterThan(0);
  });

  it('returns null content for missing files (404)', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(makeMockResponse('Not found', 404)),
    );

    const s3 = new S3FetchClient({
      r2Endpoint: 'https://test.com',
      r2Bucket: 'test-bucket',
    });
    const hydrator = new WorkspaceHydrator({ s3 });

    const workspace = await hydrator.readWorkspace('agent-missing');
    expect(workspace.files['soul.md']).toBeNull();
    expect(workspace.files['identity.md']).toBeNull();
    expect(workspace.files['user.md']).toBeNull();
    expect(workspace.files['memory.md']).toBeNull();
    expect(workspace.files['tools.md']).toBeNull();
  });

  it('writes files and invalidates cache', async () => {
    let putCalled = false;
    mockFetch.mockImplementation((_url: string, opts?: RequestInit) => {
      if (opts?.method === 'PUT') {
        putCalled = true;
      }
      return Promise.resolve(makeMockResponse('', 200));
    });

    const s3 = new S3FetchClient({
      r2Endpoint: 'https://test.com',
      r2Bucket: 'test-bucket',
    });
    const hydrator = new WorkspaceHydrator({ s3 });

    await hydrator.writeFile('agent-1', 'soul.md', '# Updated soul');
    expect(putCalled).toBe(true);
  });

  it('throws on invalid file name', async () => {
    const s3 = new S3FetchClient({
      r2Endpoint: 'https://test.com',
      r2Bucket: 'test-bucket',
    });
    const hydrator = new WorkspaceHydrator({ s3 });

    await expect(
      hydrator.writeFile('agent-1', 'invalid.txt' as any, 'content'),
    ).rejects.toThrow();
  });
});
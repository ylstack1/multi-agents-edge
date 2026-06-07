import { describe, it, expect, vi } from 'vitest';
import { DeferredFlusher } from '../src/deferred-flusher.js';
import { S3FetchClient } from '../src/s3-fetch-client.js';

describe('DeferredFlusher', () => {
  function makeMockS3() {
    return new S3FetchClient({
      r2Endpoint: 'https://test.com',
      r2Bucket: 'test-bucket',
    });
  }

  it('queues operations without executing immediately', () => {
    const flusher = new DeferredFlusher(makeMockS3());
    flusher.queue('agent-1', 'memory.md', '# Updated memory');
    expect(flusher.queueLength).toBe(1);
    flusher.queue('agent-1', 'soul.md', '# Updated soul');
    expect(flusher.queueLength).toBe(2);
  });

  it('drains queue after flush', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );

    const flusher = new DeferredFlusher(makeMockS3());
    flusher.queue('agent-1', 'memory.md', '# Test');

    // Flush will attempt the HTTP call and internally log the error
    // but drain the queue
    await flusher.flushAll();
    expect(flusher.queueLength).toBe(0);
  });

  it('handles empty queue gracefully', async () => {
    const flusher = new DeferredFlusher(makeMockS3());
    const result = await flusher.flushAll();
    expect(result).toHaveLength(0);
  });

  it('returns successful operations after flush', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );

    const flusher = new DeferredFlusher(makeMockS3());
    flusher.queue('agent-1', 'memory.md', '# Memory');
    flusher.queue('agent-2', 'soul.md', '# Soul');

    await flusher.flushAll();
    expect(flusher.queueLength).toBe(0);
  });
});
import { describe, it, expect, vi } from 'vitest';
import { withTimeout } from '../src/timeout-controller.js';

describe('withTimeout', () => {
  it('resolves with result when promise completes in time', async () => {
    const result = await withTimeout(
      Promise.resolve('success'),
      1000,
      'test operation',
    );
    expect(result).toBe('success');
  });

  it('rejects when promise takes too long', async () => {
    await expect(
      withTimeout(
        new Promise((resolve) => setTimeout(resolve, 5000)),
        10,
        'slow operation',
      ),
    ).rejects.toThrow('timed out');
  });

  it('rejects with context in error message', async () => {
    await expect(
      withTimeout(
        new Promise((resolve) => setTimeout(resolve, 5000)),
        10,
        'MCP search_web',
      ),
    ).rejects.toThrow('MCP search_web');
  });

  it('propagates rejection from inner promise', async () => {
    await expect(
      withTimeout(
        Promise.reject(new Error('inner error')),
        1000,
        'test',
      ),
    ).rejects.toThrow('inner error');
  });
});
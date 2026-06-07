import type { SSEMessage } from './types.js';

/**
 * Edge-native SSE consumer using only Web ReadableStream API.
 * No Node.js `stream` or `net` modules. Safe for V8 isolates.
 */
export class SSEConsumer {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private abortController: AbortController;

  constructor() {
    this.abortController = new AbortController();
  }

  /**
   * Connect to an SSE endpoint and consume messages.
   * Returns an async generator yielding parsed SSE messages.
   */
  async *connect(url: string, options?: {
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }): AsyncGenerator<SSEMessage> {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...options?.headers,
      },
      signal: options?.signal ?? this.abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
    }

    const body = response.body;
    if (!body) {
      throw new Error('SSE response has no body (ReadableStream not available)');
    }

    this.reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await this.reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE messages from buffer (delimited by \n\n)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const message = this.parseSSEMessage(part);
          if (message) {
            yield message;
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const message = this.parseSSEMessage(buffer);
        if (message) {
          yield message;
        }
      }
    } finally {
      this.close();
    }
  }

  /**
   * Parse a single SSE message block.
   */
  private parseSSEMessage(block: string): SSEMessage | null {
    const lines = block.split('\n');
    let event: string | undefined;
    let data = '';
    let id: string | undefined;

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        event = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        data += (data ? '\n' : '') + line.slice(6);
      } else if (line.startsWith('id: ')) {
        id = line.slice(4).trim();
      } else if (line === 'data: [DONE]') {
        return null; // Stream termination signal
      }
    }

    if (!data) return null;

    return { event, data, id };
  }

  /**
   * Abort the SSE connection.
   */
  abort(): void {
    this.abortController.abort();
    this.close();
  }

  private close(): void {
    if (this.reader) {
      try {
        this.reader.cancel();
      } catch {
        // Reader may already be closed
      }
      this.reader = null;
    }
  }
}
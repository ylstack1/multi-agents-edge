/**
 * AbortSignal-based timeout controller for MCP connections.
 * No Node.js `timers` module dependency — uses Web API AbortSignal.
 * Safe for V8 isolates.
 */

export interface TimeoutResult {
  timedOut: boolean;
  durationMs: number;
}

/**
 * Creates an AbortSignal that fires after `timeoutMs` milliseconds.
 * Compatible with Cloudflare Workers and edge runtimes.
 */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

/**
 * Executes a promise with a timeout guard.
 * If the promise doesn't settle within timeoutMs, the signal is aborted
 * and the function rejects with a TimeoutError.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string = 'operation',
): Promise<T> {
  const signal = createTimeoutSignal(timeoutMs);

  // Race the promise against the timeout
  const result = await Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          reject(new Error(`${context} timed out after ${timeoutMs}ms`));
        },
        { once: true },
      );
    }),
  ]);

  return result;
}

/**
 * Track execution duration for MCP operations.
 */
export function measureDuration(): { start(): void; stop(): TimeoutResult } {
  const startTime = Date.now();
  return {
    start: () => {},
    stop: (): TimeoutResult => ({
      timedOut: false,
      durationMs: Date.now() - startTime,
    }),
  };
}

/**
 * Create a promise that rejects after a timeout.
 */
export function delay(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}
/**
 * SSE keep-alive manager.
 * Uses AbortController to maintain heartbeat pings.
 */

export interface KeepAliveConfig {
  pingIntervalMs: number;
  maxMissedPings: number;
}

export class SSEKeepAlive {
  private config: KeepAliveConfig;
  private lastPing: number = Date.now();
  private missedPings: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<KeepAliveConfig> = {}) {
    this.config = {
      pingIntervalMs: config.pingIntervalMs ?? 15_000,
      maxMissedPings: config.maxMissedPings ?? 4,
    };
  }

  /**
   * Start monitoring keep-alive.
   * Calls onDead when too many pings are missed.
   */
  start(onDead: () => void): void {
    this.lastPing = Date.now();
    this.missedPings = 0;

    this.intervalId = setInterval(() => {
      const elapsed = Date.now() - this.lastPing;
      if (elapsed > this.config.pingIntervalMs * 2) {
        this.missedPings++;
        if (this.missedPings >= this.config.maxMissedPings) {
          this.stop();
          onDead();
        }
      }
    }, this.config.pingIntervalMs);
  }

  /**
   * Record a received ping/heartbeat.
   */
  recordPing(): void {
    this.lastPing = Date.now();
    this.missedPings = 0;
  }

  /**
   * Stop monitoring.
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  get isConnected(): boolean {
    return this.intervalId !== null;
  }

  get health(): 'healthy' | 'degraded' | 'dead' {
    if (this.missedPings === 0) return 'healthy';
    if (this.missedPings < this.config.maxMissedPings) return 'degraded';
    return 'dead';
  }
}
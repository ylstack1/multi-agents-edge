import type { TraceNode, ExecutionTrace } from '@midas/contracts';

/**
 * Execution tracer for the multi-agent workflow.
 * Generates sequential chain-of-custody diagrams for delegated tasks.
 */
export class ExecutionTracer {
  private trace: ExecutionTrace;

  constructor(sessionId: string) {
    this.trace = {
      traceId: crypto.randomUUID(),
      sessionId,
      startedAt: Date.now(),
      nodes: [],
      status: 'running',
    };
  }

  /**
   * Add a node to the execution trace.
   */
  addNode(node: Omit<TraceNode, 'id' | 'timestamp'>): TraceNode {
    const fullNode: TraceNode = {
      ...node,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    this.trace.nodes.push(fullNode);
    return fullNode;
  }

  /**
   * Complete a node by updating its duration and status.
   */
  completeNode(nodeId: string, status: TraceNode['status']): void {
    const node = this.trace.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.status = status;
      node.durationMs = Date.now() - node.timestamp;
    }
  }

  /**
   * Mark a node as errored.
   */
  errorNode(nodeId: string, error: string): void {
    const node = this.trace.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.status = 'error';
      node.durationMs = Date.now() - node.timestamp;
      node.metadata = { ...node.metadata, error };
    }
  }

  /**
   * Finish the trace.
   */
  complete(): ExecutionTrace {
    this.trace.completedAt = Date.now();
    this.trace.status = this.trace.nodes.some((n) => n.status === 'error')
      ? 'failed'
      : 'completed';
    return this.trace;
  }

  /**
   * Create a default trace for a user request flow.
   */
  static createDefaultFlow(sessionId: string): ExecutionTracer {
    const tracer = new ExecutionTracer(sessionId);
    tracer.addNode({
      type: 'user_request',
      label: 'User Request Received',
      status: 'success',
    });
    return tracer;
  }

  /**
   * Get the trace data.
   */
  getTrace(): ExecutionTrace {
    return { ...this.trace };
  }
}
import type { JSONRPCMessage } from './types.js';

/**
 * Parse aggregated SSE data strings into JSON-RPC messages.
 * Safe parsing with packet fragmentation handling.
 */
export function parseJSONRPCMessage(data: string): JSONRPCMessage {
  try {
    const parsed = JSON.parse(data);

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('JSON-RPC message must be a JSON object');
    }

    if (parsed.jsonrpc !== '2.0') {
      throw new Error('Invalid JSON-RPC version: must be "2.0"');
    }

    return parsed as JSONRPCMessage;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `Failed to parse JSON-RPC message: invalid JSON. Data: "${data.slice(0, 100)}..."`,
      );
    }
    throw err;
  }
}

/**
 * Safely parse a batch of SSE data strings into JSON-RPC messages.
 * Filters out invalid messages without throwing.
 */
export function parseBatch(messages: string[]): JSONRPCMessage[] {
  const results: JSONRPCMessage[] = [];

  for (const msg of messages) {
    try {
      results.push(parseJSONRPCMessage(msg));
    } catch {
      // Silently skip malformed messages
      continue;
    }
  }

  return results;
}

/**
 * Extract tool call information from a JSON-RPC message.
 * Returns tool name and arguments if applicable.
 */
export function extractToolCall(
  message: JSONRPCMessage,
): { method: string; args: Record<string, unknown> } | null {
  if (message.method === 'tools/call') {
    const params = message.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
    if (params?.name) {
      return {
        method: params.name,
        args: params.arguments ?? {},
      };
    }
  }
  return null;
}

/**
 * Create a JSON-RPC request message.
 */
export function createRequest(method: string, params?: unknown, id?: string | number): JSONRPCMessage {
  return {
    jsonrpc: '2.0',
    id: id ?? crypto.randomUUID(),
    method,
    params,
  };
}

/**
 * Create a JSON-RPC response message.
 */
export function createResponse(
  id: string | number,
  result: unknown,
): JSONRPCMessage {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Create a JSON-RPC error message.
 */
export function createError(
  id: string | number,
  code: number,
  message: string,
  data?: unknown,
): JSONRPCMessage {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
}
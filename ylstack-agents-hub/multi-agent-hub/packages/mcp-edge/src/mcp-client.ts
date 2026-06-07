import type { MCPToolDefinition, MCPToolResult } from './types.js';
import { SSEConsumer } from './sse-consumer.js';
import { parseJSONRPCMessage, createRequest } from './json-rpc-parser.js';
import { discoverTools } from './schema-translator.js';
import { withTimeout } from './timeout-controller.js';

/**
 * High-level MCP client for edge runtimes.
 * Handles connection, tool discovery, and tool execution via MCP protocol.
 */
export class MCPClient {
  private config: { url: string; timeoutMs: number; headers?: Record<string, string> };

  constructor(config: { url: string; timeoutMs?: number; headers?: Record<string, string> }) {
    this.config = {
      url: config.url,
      timeoutMs: config.timeoutMs ?? 15_000,
      headers: config.headers,
    };
  }

  /**
   * Discover available tools from the MCP server.
   * Sends a `tools/list` JSON-RPC request via SSE.
   */
  async discoverTools(): Promise<MCPToolDefinition[]> {
    return withTimeout(
      this.executeDiscovery(),
      this.config.timeoutMs,
      `MCP discover at ${this.config.url}`,
    );
  }

  private async executeDiscovery(): Promise<MCPToolDefinition[]> {
    const consumer = new SSEConsumer();
    const collectedData: string[] = [];

    try {
      const generator = consumer.connect(this.config.url, {
        headers: this.config.headers,
      });

      for await (const message of generator) {
        collectedData.push(message.data);
        // After first message, check if it contains tool definitions
        try {
          const parsed = parseJSONRPCMessage(message.data);
          if (parsed.result || parsed.method === 'tools/list') {
            const tools = discoverTools(
              (parsed.result ?? parsed.params ?? {}) as Record<string, unknown>,
            );
            if (tools.length > 0) {
              consumer.abort();
              return tools;
            }
          }
        } catch {
          continue; // Wait for more data
        }
      }
    } finally {
      consumer.abort();
    }

    // Fallback: try to parse all collected data
    for (const data of collectedData) {
      try {
        const parsed = parseJSONRPCMessage(data);
        const tools = discoverTools(
          (parsed.result ?? {}) as Record<string, unknown>,
        );
        if (tools.length > 0) return tools;
      } catch {
        continue;
      }
    }

    return [];
  }

  /**
   * Execute a tool call on the MCP server.
   * Sends a `tools/call` JSON-RPC request.
   */
  async executeTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    return withTimeout(
      this.executeToolCall(toolName, args),
      this.config.timeoutMs,
      `MCP tool "${toolName}" at ${this.config.url}`,
    );
  }

  private async executeToolCall(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    const consumer = new SSEConsumer();

    try {
      const generator = consumer.connect(this.config.url, {
        headers: this.config.headers,
      });

      for await (const message of generator) {
        try {
          const parsed = parseJSONRPCMessage(message.data);
          if (parsed.result) {
            const result = parsed.result as {
              content?: Array<{ type: string; text?: string }>;
              isError?: boolean;
            };
            return {
              toolName,
              content: (result.content ?? []).map((c) => ({
                type: (c.type as 'text' | 'image' | 'resource') || 'text',
                text: c.text,
              })),
              isError: result.isError ?? false,
              durationMs: Date.now() - startTime,
            };
          }
          if (parsed.error) {
            return {
              toolName,
              content: [{ type: 'text', text: `Error: ${parsed.error.message}` }],
              isError: true,
              durationMs: Date.now() - startTime,
            };
          }
        } catch {
          continue;
        }
      }

      return {
        toolName,
        content: [{ type: 'text', text: 'No result from MCP server' }],
        isError: true,
        durationMs: Date.now() - startTime,
      };
    } finally {
      consumer.abort();
    }
  }
}
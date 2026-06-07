import type { MCPToolDefinition } from './types.js';

/**
 * Transforms MCP tool definitions into LLM-compatible function-calling schemas.
 * Supports OpenAI and Anthropic formats.
 */

export interface LLMFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Translate MCP tool definitions to OpenAI-compatible function tools.
 */
export function toOpenAIFormat(tools: MCPToolDefinition[]): LLMFunctionTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: translateSchema(tool.inputSchema),
    },
  }));
}

/**
 * Translate MCP tool definitions to Anthropic-compatible tool format.
 */
export function toAnthropicFormat(tools: MCPToolDefinition[]): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? '',
    input_schema: translateSchema(tool.inputSchema),
  }));
}

/**
 * Translate MCP JSON Schema to LLM-compatible schema.
 * Normalizes common schema patterns.
 */
function translateSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {} };
  }

  // Many MCP servers omit `type: "object"` at the top level; add it if missing
  const translated = { ...schema };

  if (!translated.type) {
    translated.type = 'object';
  }

  // Ensure `properties` exists for object schemas
  if (translated.type === 'object' && !translated.properties) {
    translated.properties = {};
  }

  return translated;
}

/**
 * Discover tools from an array of MCP server responses.
 * Extracts tool definitions from the standard MCP `tools/list` result format.
 */
export function discoverTools(rawDiscovery: Record<string, unknown>): MCPToolDefinition[] {
  const tools = rawDiscovery.tools ?? rawDiscovery.result ?? [];

  if (!Array.isArray(tools)) {
    return [];
  }

  return (tools as Array<Record<string, unknown>>).map((t) => ({
    name: String(t.name ?? 'unknown'),
    description: t.description ? String(t.description) : undefined,
    inputSchema: (t.inputSchema ?? t.parameters ?? {}) as Record<string, unknown>,
  }));
}
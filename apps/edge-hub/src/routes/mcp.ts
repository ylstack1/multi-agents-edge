import { Hono } from 'hono';
import { MCPClient } from '@midas/mcp-edge';
import type { Env } from '../../worker-configuration.d.ts';

const mcpRoutes = new Hono<{ Bindings: Env }>();

// Configure a new MCP endpoint
mcpRoutes.post('/endpoints', async (c) => {
  const body = await c.req.json<{
    url: string;
    name?: string;
    apiKey?: string;
    timeoutMs?: number;
  }>();

  // Store MCP endpoint config (in production, persist to KV/R2)
  return c.json({
    success: true,
    data: {
      id: crypto.randomUUID(),
      name: body.name ?? 'MCP Server',
      url: body.url,
      configured: true,
    },
  });
});

// Ping & Discover - connect to MCP server and discover tools
mcpRoutes.post('/discover', async (c) => {
  const { url, apiKey, timeoutMs } = await c.req.json<{
    url: string;
    apiKey?: string;
    timeoutMs?: number;
  }>();

  if (!url) {
    return c.json({ success: false, error: { code: 'MISSING_URL', message: 'MCP server URL is required' } }, 400);
  }

  const startTime = Date.now();

  try {
    const client = new MCPClient({
      url,
      timeoutMs: timeoutMs ?? 15_000,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });

    const tools = await client.discoverTools();
    const latencyMs = Date.now() - startTime;

    return c.json({
      success: true,
      data: {
        status: 'connected',
        tools,
        latencyMs,
        toolCount: tools.length,
      },
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return c.json({
      success: true,
      data: {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Connection failed',
        latencyMs,
      },
    });
  }
});

// Execute an MCP tool
mcpRoutes.post('/execute', async (c) => {
  const { url, toolName, arguments: args, apiKey, timeoutMs } = await c.req.json<{
    url: string;
    toolName: string;
    arguments: Record<string, unknown>;
    apiKey?: string;
    timeoutMs?: number;
  }>();

  if (!url || !toolName) {
    return c.json({
      success: false,
      error: { code: 'MISSING_PARAMS', message: 'URL and toolName are required' },
    }, 400);
  }

  try {
    const client = new MCPClient({
      url,
      timeoutMs: timeoutMs ?? 15_000,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });

    const result = await client.executeTool(toolName, args);

    return c.json({ success: true, data: result });
  } catch (err) {
    return c.json({
      success: false,
      error: {
        code: 'TOOL_EXECUTION_FAILED',
        message: err instanceof Error ? err.message : 'Tool execution failed',
      },
    }, 502);
  }
});

export { mcpRoutes };
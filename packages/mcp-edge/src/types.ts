export interface MCPServerConfig {
  url: string;
  transport: 'sse' | 'stdio';
  apiKey?: string;
  headers?: Record<string, string>;
  timeoutMs: number;
}

export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolResult {
  toolName: string;
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError: boolean;
  durationMs?: number;
}

export interface SSEMessage {
  event?: string;
  data: string;
  id?: string;
}

export interface JSONRPCMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
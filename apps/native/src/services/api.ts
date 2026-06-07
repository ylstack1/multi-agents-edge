export interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  lastModified: string;
  workspace: {
    soul: string;
    identity: string;
    user: string;
    memory: string;
    tools: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  agentId?: string;
}

export interface MCPEndpoint {
  id: string;
  name: string;
  url: string;
  status: 'online' | 'offline' | 'unknown';
  tools: MCPTool[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ApiError {
  message: string;
  status?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function getBaseUrl(): string {
  try {
    const { useAppStore } = require('../store/appStore');
    const store = useAppStore.getState?.();
    return store?.apiUrl || 'http://localhost:8787';
  } catch {
    return 'http://localhost:8787';
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw new Error('Request failed after retries');
}

function handleError(error: unknown): never {
  if (error instanceof TypeError && error.message === 'Network request failed') {
    throw { message: 'Network error: Unable to reach the server', status: 0 };
  }
  if (error && typeof error === 'object' && 'message' in error) {
    throw error;
  }
  throw { message: String(error), status: 500 };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;

  try {
    const response = await fetchWithRetry(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw {
        message: errorBody || `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      };
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  } catch (error) {
    return handleError(error);
  }
}

// Agents / Workspace
export async function fetchAgents(): Promise<Agent[]> {
  return request<Agent[]>('GET', '/api/agents');
}

export async function fetchAgent(id: string): Promise<Agent> {
  return request<Agent>('GET', `/api/agents/${encodeURIComponent(id)}`);
}

export async function createAgent(data: {
  name: string;
  type: string;
}): Promise<Agent> {
  return request<Agent>('POST', '/api/agents', data);
}

export async function updateAgentWorkspace(
  agentId: string,
  workspace: Partial<Agent['workspace']>
): Promise<Agent> {
  return request<Agent>(
    'PATCH',
    `/api/agents/${encodeURIComponent(agentId)}/workspace`,
    workspace
  );
}

export async function resetAgentMemory(agentId: string): Promise<void> {
  return request<void>(
    'DELETE',
    `/api/agents/${encodeURIComponent(agentId)}/workspace/memory`
  );
}

export async function deleteAgent(id: string): Promise<void> {
  return request<void>('DELETE', `/api/agents/${encodeURIComponent(id)}`);
}

// Chat
export async function sendMessage(
  agentId: string,
  content: string,
  conversationId?: string
): Promise<{
  message: Message;
  conversationId: string;
}> {
  return request('POST', `/api/chat/${encodeURIComponent(agentId)}`, {
    content,
    conversationId,
  });
}

export async function fetchConversation(
  agentId: string,
  conversationId: string
): Promise<Message[]> {
  return request<Message[]>(
    'GET',
    `/api/chat/${encodeURIComponent(agentId)}/${encodeURIComponent(conversationId)}`
  );
}

// MCP
export async function fetchMCPEndpoints(): Promise<MCPEndpoint[]> {
  return request<MCPEndpoint[]>('GET', '/api/mcp/endpoints');
}

export async function addMCPEndpoint(data: {
  name: string;
  url: string;
}): Promise<MCPEndpoint> {
  return request<MCPEndpoint>('POST', '/api/mcp/endpoints', data);
}

export async function pingMCPEndpoint(id: string): Promise<{ status: string }> {
  return request<{ status: string }>(
    'GET',
    `/api/mcp/endpoints/${encodeURIComponent(id)}/ping`
  );
}

export async function discoverMCPTools(
  id: string
): Promise<{ tools: MCPTool[] }> {
  return request<{ tools: MCPTool[] }>(
    'GET',
    `/api/mcp/endpoints/${encodeURIComponent(id)}/discover`
  );
}

export async function deleteMCPEndpoint(id: string): Promise<void> {
  return request<void>(
    'DELETE',
    `/api/mcp/endpoints/${encodeURIComponent(id)}`
  );
}

// Health
export async function pingServer(): Promise<{ status: string }> {
  return request<{ status: string }>('GET', '/api/health');
}
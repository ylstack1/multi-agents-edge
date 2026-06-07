/**
 * API client for the Multi-Agent Hub VFS backend.
 * Provides typed fetch wrappers for workspace, agent, chat, and MCP operations.
 */

const API_BASE = import.meta.env.VITE_API_URL || "/api";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApiError(
      `API error ${response.status}: ${body || response.statusText}`,
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ─── Agent Operations ────────────────────────────────────────────

export interface AgentDto {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function listAgents(): Promise<AgentDto[]> {
  return request<AgentDto[]>("/agents");
}

export async function getAgent(id: string): Promise<AgentDto> {
  return request<AgentDto>(`/agents/${encodeURIComponent(id)}`);
}

export async function createAgent(
  data: Partial<AgentDto>,
): Promise<AgentDto> {
  return request<AgentDto>("/agents", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteAgent(id: string): Promise<void> {
  return request<void>(`/agents/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ─── Workspace / VFS Operations ──────────────────────────────────

export interface FileDto {
  path: string;
  content: string;
}

export interface WorkspaceDto {
  agentId: string;
  files: FileDto[];
}

export async function getWorkspace(
  agentId: string,
): Promise<WorkspaceDto> {
  return request<WorkspaceDto>(
    `/workspace/${encodeURIComponent(agentId)}`,
  );
}

export async function getFile(
  agentId: string,
  filePath: string,
): Promise<FileDto> {
  return request<FileDto>(
    `/workspace/${encodeURIComponent(agentId)}/file/${encodeURIComponent(filePath)}`,
  );
}

export async function saveFile(
  agentId: string,
  filePath: string,
  content: string,
): Promise<FileDto> {
  return request<FileDto>(
    `/workspace/${encodeURIComponent(agentId)}/file/${encodeURIComponent(filePath)}`,
    {
      method: "PUT",
      body: JSON.stringify({ content }),
    },
  );
}

export async function resetMemory(agentId: string): Promise<void> {
  return request<void>(
    `/workspace/${encodeURIComponent(agentId)}/reset`,
    { method: "POST" },
  );
}

// ─── Chat Operations ─────────────────────────────────────────────

export interface ChatRequest {
  agentId: string;
  message: string;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  message: string;
  role: string;
  toolCalls?: Array<{
    name: string;
    arguments: string;
    result?: string;
  }>;
  reasoning?: string;
}

export async function sendChat(
  agentId: string,
  message: string,
): Promise<ChatResponse> {
  return request<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify({
      agentId,
      message,
    } satisfies ChatRequest),
  });
}

export async function streamChat(
  agentId: string,
  message: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const url = `${API_BASE}/chat`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, message, stream: true } satisfies ChatRequest),
  });

  if (!response.ok) {
    throw new ApiError(
      `Chat stream error: ${response.status}`,
      response.status,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body for streaming");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        onChunk(data);
      }
    }
  }
}

// ─── MCP Operations ──────────────────────────────────────────────

export interface McpEndpointDto {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface McpToolDto {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export async function listMcpEndpoints(): Promise<McpEndpointDto[]> {
  return request<McpEndpointDto[]>("/mcp/endpoints");
}

export async function addMcpEndpoint(
  data: Omit<McpEndpointDto, "id">,
): Promise<McpEndpointDto> {
  return request<McpEndpointDto>("/mcp/endpoints", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteMcpEndpoint(id: string): Promise<void> {
  return request<void>(`/mcp/endpoints/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function pingMcpEndpoint(
  id: string,
): Promise<{ status: string; latency: number }> {
  return request<{ status: string; latency: number }>(
    `/mcp/endpoints/${encodeURIComponent(id)}/ping`,
  );
}

export async function discoverTools(
  endpointId: string,
): Promise<McpToolDto[]> {
  return request<McpToolDto[]>(
    `/mcp/endpoints/${encodeURIComponent(endpointId)}/tools`,
  );
}

// ─── Diff / Trace Operations ─────────────────────────────────────

export interface DiffEntry {
  filePath: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "delete" | "context";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface TraceNodeDto {
  id: string;
  type: "agent" | "tool" | "llm" | "error";
  label: string;
  duration?: number;
  status: "success" | "error" | "running";
  children?: TraceNodeDto[];
  error?: string;
  reasoning?: string;
}

export async function getDiff(
  agentId: string,
): Promise<DiffEntry[]> {
  return request<DiffEntry[]>(
    `/workspace/${encodeURIComponent(agentId)}/diff`,
  );
}

export async function getTrace(
  sessionId: string,
): Promise<TraceNodeDto> {
  return request<TraceNodeDto>(
    `/trace/${encodeURIComponent(sessionId)}`,
  );
}

export { ApiError, API_BASE };
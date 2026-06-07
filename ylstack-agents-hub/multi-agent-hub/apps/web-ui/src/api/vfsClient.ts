/**
 * API client for the Multi-Agent Hub VFS backend.
 * Provides typed fetch wrappers for workspace, agent, chat, MCP, and settings operations.
 */

const API_BASE = import.meta.env.VITE_API_URL || "/api";

// Generate session token for API auth
function getSessionToken(): string {
  try {
    return btoa('lead:WEB_UI');
  } catch {
    return '';
  }
}

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
      "Authorization": `Bearer ${getSessionToken()}`,
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
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getSessionToken()}` },
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

// ─── Settings Operations ─────────────────────────────────────────

export interface ProviderInfo {
  provider: string;
  enabled: boolean;
  defaultModel: string;
  models: string[];
  hasApiKey: boolean;
  isCustom: boolean;
  label: string;
}

export interface TelegramBotInfo {
  botId: string;
  leadAgentId: string;
  agentMappings: Record<string, string>;
  defaultAgentId?: string;
  label?: string;
  enabled: boolean;
  hasBotToken: boolean;
  allowedChatIds?: number[];
  webhookUrl?: string;
  webhookSetAt?: number;
}

export interface MarketplaceProvider {
  id: string;
  label: string;
  description: string;
  baseUrl: string;
  category: string;
  iconUrl?: string;
  docsUrl?: string;
  requiresKey: boolean;
  builtIn: boolean;
}

export interface IntegrationInfo {
  type: string;
  enabled: boolean;
  label: string;
  configured: boolean;
  config?: Record<string, unknown>;
}

/** GET /api/settings — Load all settings (keys stripped) */
export async function getSettings(): Promise<any> {
  const result = await request<{ success: boolean; data: any }>("/settings");
  return result.data;
}

/** PUT /api/settings — Save all settings */
export async function saveSettings(settings: any): Promise<any> {
  return request<any>("/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

/** GET /api/settings/providers — List all providers */
export async function listProviders(): Promise<ProviderInfo[]> {
  const result = await request<{ success: boolean; data: ProviderInfo[] }>("/settings/providers");
  return result.data;
}

/** PUT /api/settings/providers/:provider — Update provider */
export async function updateProvider(
  provider: string,
  data: {
    enabled?: boolean;
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    models?: string[];
    customModels?: string[];
    label?: string;
  },
): Promise<void> {
  await request(`/settings/providers/${encodeURIComponent(provider)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** POST /api/settings/providers/:provider/test — Test provider */
export async function testProvider(
  provider: string,
): Promise<{ ok: boolean; latencyMs: number }> {
  const result = await request<{ success: boolean; data: { ok: boolean; latencyMs: number } }>(
    `/settings/providers/${encodeURIComponent(provider)}/test`,
    { method: "POST" },
  );
  return result.data;
}

/** POST /api/settings/providers/:provider/models — Fetch models */
export async function fetchProviderModels(
  provider: string,
): Promise<string[]> {
  const result = await request<{ success: boolean; data: { models: string[] } }>(
    `/settings/providers/${encodeURIComponent(provider)}/models`,
    { method: "POST" },
  );
  return result.data.models;
}

/** GET /api/settings/marketplace — List marketplace providers */
export async function getMarketplace(): Promise<{ builtIn: MarketplaceProvider[]; community: MarketplaceProvider[] }> {
  const result = await request<{ success: boolean; data: { builtIn: MarketplaceProvider[]; community: MarketplaceProvider[] } }>(
    "/settings/marketplace",
  );
  return result.data;
}

/** PUT /api/settings/custom-providers/:id — Add/update custom provider */
export async function upsertCustomProvider(
  id: string,
  data: {
    label: string;
    baseUrl: string;
    apiKey?: string;
    defaultModel?: string;
    models?: string[];
    enabled?: boolean;
  },
): Promise<void> {
  await request(`/settings/custom-providers/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** DELETE /api/settings/custom-providers/:id — Remove custom provider */
export async function deleteCustomProvider(id: string): Promise<void> {
  await request(`/settings/custom-providers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** GET /api/settings/integrations — List integrations */
export async function listIntegrations(): Promise<IntegrationInfo[]> {
  const result = await request<{ success: boolean; data: IntegrationInfo[] }>(
    "/settings/integrations",
  );
  return result.data;
}

/** PUT /api/settings/integrations/:type — Update integration */
export async function updateIntegration(
  type: string,
  data: {
    enabled?: boolean;
    config?: Record<string, unknown>;
    label?: string;
  },
): Promise<void> {
  await request(`/settings/integrations/${encodeURIComponent(type)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** PUT /api/settings/integrations/github — Quick GitHub config */
export async function updateGitHubIntegration(data: {
  token?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  autoSync?: boolean;
  enabled?: boolean;
}): Promise<void> {
  await request("/settings/integrations/github", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** PUT /api/settings/integrations/skills — Quick skills config */
export async function updateSkillsIntegration(data: {
  enabledList?: string[];
  autoDiscover?: boolean;
  customSkillDirs?: string[];
  enabled?: boolean;
}): Promise<void> {
  await request("/settings/integrations/skills", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** GET /api/settings/telegram — Get Telegram configs */
export async function getTelegramSettings(): Promise<{
  bots: TelegramBotInfo[];
  hasBotToken: boolean;
  webhookBaseUrl?: string;
  botCount: number;
}> {
  const result = await request<{ success: boolean; data: any }>("/settings/telegram");
  return result.data;
}

/** PUT /api/settings/telegram — Update Telegram settings */
export async function updateTelegramSettings(data: {
  bots?: TelegramBotInfo[];
  webhookBaseUrl?: string;
}): Promise<void> {
  await request("/settings/telegram", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** PUT /api/settings/telegram/bots/:botId — Upsert bot */
export async function upsertTelegramBot(
  botId: string,
  data: Partial<TelegramBotInfo> & { botToken?: string },
): Promise<void> {
  await request(`/settings/telegram/bots/${encodeURIComponent(botId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** DELETE /api/settings/telegram/bots/:botId — Delete bot */
export async function deleteTelegramBot(botId: string): Promise<void> {
  await request(`/settings/telegram/bots/${encodeURIComponent(botId)}`, {
    method: "DELETE",
  });
}

/** POST /api/settings/telegram/bots/:botId/set-webhook — Set webhook */
export async function setTelegramWebhook(botId: string): Promise<any> {
  const result = await request<{ success: boolean; data: any }>(
    `/settings/telegram/bots/${encodeURIComponent(botId)}/set-webhook`,
    { method: "POST" },
  );
  return result.data;
}

/** POST /api/settings/telegram/bots/:botId/delete-webhook — Delete webhook */
export async function deleteTelegramWebhook(botId: string): Promise<any> {
  const result = await request<{ success: boolean; data: any }>(
    `/settings/telegram/bots/${encodeURIComponent(botId)}/delete-webhook`,
    { method: "POST" },
  );
  return result.data;
}

export { ApiError, API_BASE };
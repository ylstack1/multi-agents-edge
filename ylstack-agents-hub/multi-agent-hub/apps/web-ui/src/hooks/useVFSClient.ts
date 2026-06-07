import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAgents as apiListAgents,
  getAgent,
  createAgent,
  deleteAgent,
  getWorkspace,
  getFile,
  saveFile,
  resetMemory,
  sendChat,
  listMcpEndpoints,
  addMcpEndpoint,
  deleteMcpEndpoint,
  pingMcpEndpoint,
  discoverTools,
  getDiff,
  getTrace,
  type AgentDto,
  type WorkspaceDto,
  type FileDto,
  type ChatResponse,
  type DiffEntry,
  type TraceNodeDto,
} from "@/api/vfsClient";
import { useWorkspaceStore } from "@/store/workspaceStore";

// ─── Agent Queries ───────────────────────────────────────────────

export function useAgents() {
  const setAgents = useWorkspaceStore((s) => s.setAgents);

  return useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const result = await apiListAgents();
      // Map backend DTO (agentId, lastModified, files) to store Agent type
      const agents = result.map((a: any) => ({
        id: a.agentId || a.id,
        name: a.agentId === "lead" ? "Lead Agent" : (a.name || a.agentId || "Unknown"),
        status: "idle" as const,
        description: a.agentId === "lead"
          ? "System orchestrator — manages all agents and tools"
          : (a.description || "Sub-agent"),
        lastActive: a.lastModified || Date.now(),
      }));
      setAgents(agents);
      return agents;
    },
  });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: () => getAgent(id),
    enabled: !!id,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AgentDto>) => createAgent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

// ─── Workspace Queries ───────────────────────────────────────────

export function useWorkspace(agentId: string) {
  const setFiles = useWorkspaceStore((s) => s.setFiles);

  return useQuery({
    queryKey: ["workspace", agentId],
    queryFn: async () => {
      const workspace = await getWorkspace(agentId);
      if (workspace.files) {
        setFiles(
          workspace.files.map((f) => ({
            name: f.path,
            path: f.path,
            content: f.content,
            savedContent: f.content,
            isDirty: false,
          })),
        );
      }
      return workspace;
    },
    enabled: !!agentId,
  });
}

export function useFile(agentId: string, filePath: string) {
  return useQuery({
    queryKey: ["file", agentId, filePath],
    queryFn: () => getFile(agentId, filePath),
    enabled: !!agentId && !!filePath,
  });
}

export function useSaveFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      agentId,
      filePath,
      content,
    }: {
      agentId: string;
      filePath: string;
      content: string;
    }) => saveFile(agentId, filePath, content),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace", variables.agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["file", variables.agentId, variables.filePath],
      });
    },
  });
}

export function useResetMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => resetMemory(agentId),
    onSuccess: (_data, agentId) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace", agentId],
      });
    },
  });
}

// ─── Chat Queries ────────────────────────────────────────────────

export function useSendChat() {
  return useMutation({
    mutationFn: ({
      agentId,
      message,
    }: {
      agentId: string;
      message: string;
    }) => sendChat(agentId, message),
  });
}

// ─── MCP Queries ─────────────────────────────────────────────────

export function useMcpEndpoints() {
  return useQuery({
    queryKey: ["mcp-endpoints"],
    queryFn: listMcpEndpoints,
  });
}

export function useAddMcpEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addMcpEndpoint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-endpoints"] });
    },
  });
}

export function useDeleteMcpEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMcpEndpoint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-endpoints"] });
    },
  });
}

export function usePingMcpEndpoint() {
  return useMutation({
    mutationFn: (id: string) => pingMcpEndpoint(id),
  });
}

export function useDiscoverTools() {
  return useMutation({
    mutationFn: (endpointId: string) => discoverTools(endpointId),
  });
}

// ─── Diff / Trace Queries ────────────────────────────────────────

export function useDiff(agentId: string) {
  return useQuery({
    queryKey: ["diff", agentId],
    queryFn: () => getDiff(agentId),
    enabled: !!agentId,
  });
}

export function useTrace(sessionId: string) {
  return useQuery({
    queryKey: ["trace", sessionId],
    queryFn: () => getTrace(sessionId),
    enabled: !!sessionId,
  });
}
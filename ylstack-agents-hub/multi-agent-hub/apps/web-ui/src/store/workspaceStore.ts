import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateId } from "@/lib/utils";

export interface WorkspaceFile {
  name: string;
  path: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
}

export interface McpEndpoint {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  tools?: McpTool[];
  status?: "online" | "offline" | "unknown";
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface Agent {
  id: string;
  name: string;
  status: "idle" | "active" | "error";
  description: string;
  lastActive: number;
}

export interface Workspace {
  id: string;
  agentId: string;
  files: WorkspaceFile[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  reasoning?: string;
}

export interface ToolCall {
  name: string;
  arguments: string;
  result?: string;
}

export interface WorkspaceState {
  // Active agent
  activeAgentId: string | null;
  setActiveAgentId: (id: string | null) => void;

  // Workspaces
  workspaces: Map<string, Workspace>;
  setWorkspace: (agentId: string, workspace: Workspace) => void;
  getWorkspace: (agentId: string) => Workspace | undefined;

  // Files for current workspace
  files: WorkspaceFile[];
  setFiles: (files: WorkspaceFile[]) => void;
  updateFile: (path: string, content: string) => void;
  markFileSaved: (path: string) => void;

  // MCP endpoints
  mcpEndpoints: McpEndpoint[];
  setMcpEndpoints: (endpoints: McpEndpoint[]) => void;
  addEndpoint: (endpoint: Omit<McpEndpoint, "id">) => void;
  removeEndpoint: (id: string) => void;
  updateEndpointStatus: (id: string, status: "online" | "offline" | "unknown") => void;

  // Agents
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;

  // Chat — per-agent sessions persisted to localStorage
  chatSessions: Record<string, ChatMessage[]>;
  /** Archived old sessions keyed by agentId -> sessionKey -> messages */
  chatArchive: Record<string, Record<string, ChatMessage[]>>;
  getChatMessages: (agentId: string) => ChatMessage[];
  addChatMessage: (agentId: string, message: ChatMessage) => void;
  setChatMessages: (messages: ChatMessage[], agentId: string) => void;
  clearChatMessages: (agentId: string) => void;
  /** Archive current session and start a fresh one */
  newChatSession: (agentId: string) => void;
}

const DEFAULT_FILES: WorkspaceFile[] = [
  { name: "soul.md", path: "soul.md", content: "", savedContent: "", isDirty: false },
  { name: "identity.md", path: "identity.md", content: "", savedContent: "", isDirty: false },
  { name: "user.md", path: "user.md", content: "", savedContent: "", isDirty: false },
  { name: "memory.md", path: "memory.md", content: "", savedContent: "", isDirty: false },
  { name: "tools.md", path: "tools.md", content: "", savedContent: "", isDirty: false },
];

const LEAD_AGENT: Agent = {
  id: "lead",
  name: "Lead Agent",
  status: "idle",
  description: "System orchestrator — manages all agents and tools",
  lastActive: Date.now(),
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      activeAgentId: null,
      setActiveAgentId: (id) => set({ activeAgentId: id }),

      workspaces: new Map(),
      setWorkspace: (agentId, workspace) => {
        const workspaces = new Map(get().workspaces);
        workspaces.set(agentId, workspace);
        set({ workspaces });
      },
      getWorkspace: (agentId) => {
        return get().workspaces.get(agentId);
      },

      files: DEFAULT_FILES,
      setFiles: (files) => set({ files }),
      updateFile: (path, content) => {
        const files = get().files.map((f) =>
          f.path === path
            ? { ...f, content, isDirty: content !== f.savedContent }
            : f,
        );
        set({ files });
      },
      markFileSaved: (path) => {
        const files = get().files.map((f) =>
          f.path === path ? { ...f, savedContent: f.content, isDirty: false } : f,
        );
        set({ files });
      },

      mcpEndpoints: [],
      setMcpEndpoints: (endpoints) => set({ mcpEndpoints: endpoints }),
      addEndpoint: (endpoint) => {
        const newEndpoint: McpEndpoint = {
          ...endpoint,
          id: generateId(),
        };
        set({ mcpEndpoints: [...get().mcpEndpoints, newEndpoint] });
      },
      removeEndpoint: (id) => {
        set({
          mcpEndpoints: get().mcpEndpoints.filter((e) => e.id !== id),
        });
      },
      updateEndpointStatus: (id, status) => {
        set({
          mcpEndpoints: get().mcpEndpoints.map((e) =>
            e.id === id ? { ...e, status } : e,
          ),
        });
      },

      agents: [LEAD_AGENT],
      setAgents: (agents) => {
        const hasLead = agents.some((a) => a.id === "lead");
        if (!hasLead) {
          agents.unshift({ ...LEAD_AGENT });
        }
        set({ agents });
      },

      // Chat — per-agent sessions
      chatSessions: {},
      chatArchive: {},
      getChatMessages: (agentId) => {
        return get().chatSessions[agentId] ?? [];
      },
      addChatMessage: (agentId, message) => {
        const sessions = { ...get().chatSessions };
        const messages = [...(sessions[agentId] ?? []), message];
        sessions[agentId] = messages;
        set({ chatSessions: sessions });
      },
      clearChatMessages: (agentId) => {
        const sessions = { ...get().chatSessions };
        sessions[agentId] = [];
        set({ chatSessions: sessions });
      },
      setChatMessages: (messages, agentId) => {
        const sessions = { ...get().chatSessions };
        sessions[agentId] = messages;
        set({ chatSessions: sessions });
      },
      newChatSession: (agentId) => {
        const sessions = get().chatSessions;
        const current = sessions[agentId] ?? [];
        if (current.length === 0) return; // nothing to archive
        const archive = { ...get().chatArchive };
        const agentArchive = archive[agentId] ? { ...archive[agentId] } : {};
        const key = `session-${Date.now()}`;
        agentArchive[key] = current;
        archive[agentId] = agentArchive;
        set({
          chatArchive: archive,
          chatSessions: { ...sessions, [agentId]: [] },
        });
      },
    }),
    {
      name: "midas-workspace-store",
      // Persist chat sessions + archives to localStorage
      partialize: (state) => ({
        chatSessions: state.chatSessions,
        chatArchive: state.chatArchive,
      }),
    },
  ),
);
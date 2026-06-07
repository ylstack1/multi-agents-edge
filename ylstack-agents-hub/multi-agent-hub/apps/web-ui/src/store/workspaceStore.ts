import { create } from "zustand";
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

  // Chat
  chatMessages: ChatMessage[];
  setChatMessages: (messages: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatMessages: () => void;

  // Theme
  isDark: boolean;
  toggleTheme: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
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

  files: [
    {
      name: "soul.md",
      path: "soul.md",
      content: "",
      savedContent: "",
      isDirty: false,
    },
    {
      name: "identity.md",
      path: "identity.md",
      content: "",
      savedContent: "",
      isDirty: false,
    },
    {
      name: "user.md",
      path: "user.md",
      content: "",
      savedContent: "",
      isDirty: false,
    },
    {
      name: "memory.md",
      path: "memory.md",
      content: "",
      savedContent: "",
      isDirty: false,
    },
    {
      name: "tools.md",
      path: "tools.md",
      content: "",
      savedContent: "",
      isDirty: false,
    },
  ],
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

  agents: [
    {
      id: "1",
      name: "Default Agent",
      status: "idle",
      description: "General-purpose AI assistant",
      lastActive: Date.now(),
    },
    {
      id: "2",
      name: "Code Agent",
      status: "idle",
      description: "Specialized in code generation and analysis",
      lastActive: Date.now() - 3600000,
    },
    {
      id: "3",
      name: "Research Agent",
      status: "active",
      description: "Web research and information gathering",
      lastActive: Date.now() - 600000,
    },
  ],
  setAgents: (agents) => set({ agents }),

  chatMessages: [],
  setChatMessages: (messages) => set({ chatMessages: messages }),
  addChatMessage: (message) => {
    set({ chatMessages: [...get().chatMessages, message] });
  },
  clearChatMessages: () => set({ chatMessages: [] }),

  isDark: true,
  toggleTheme: () => {
    const next = !get().isDark;
    document.documentElement.classList.toggle("dark", next);
    set({ isDark: next });
  },
}));
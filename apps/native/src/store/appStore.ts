import { create } from 'zustand';
import type { Agent, MCPEndpoint } from '../services/api';

export type Theme = 'dark' | 'light';

interface AppState {
  apiUrl: string;
  agents: Agent[];
  activeAgentId: string | null;
  mcpEndpoints: MCPEndpoint[];
  theme: Theme;
  isOnline: boolean;

  // Actions
  setApiUrl: (url: string) => void;
  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  setActiveAgentId: (id: string | null) => void;
  setMcpEndpoints: (endpoints: MCPEndpoint[]) => void;
  addMcpEndpoint: (endpoint: MCPEndpoint) => void;
  removeMcpEndpoint: (id: string) => void;
  updateMcpEndpoint: (id: string, updates: Partial<MCPEndpoint>) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setIsOnline: (isOnline: boolean) => void;
  reset: () => void;
}

const initialState = {
  apiUrl: 'http://localhost:8787',
  agents: [],
  activeAgentId: null,
  mcpEndpoints: [],
  theme: 'dark' as Theme,
  isOnline: false,
};

export const useAppStore = create<AppState>((set, _get) => ({
  ...initialState,

  setApiUrl: (apiUrl: string) => set({ apiUrl }),

  setAgents: (agents: Agent[]) => set({ agents }),

  addAgent: (agent: Agent) =>
    set((state) => ({ agents: [...state.agents, agent] })),

  removeAgent: (id: string) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
      activeAgentId: state.activeAgentId === id ? null : state.activeAgentId,
    })),

  updateAgent: (id: string, updates: Partial<Agent>) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),

  setActiveAgentId: (activeAgentId: string | null) => set({ activeAgentId }),

  setMcpEndpoints: (mcpEndpoints: MCPEndpoint[]) => set({ mcpEndpoints }),

  addMcpEndpoint: (endpoint: MCPEndpoint) =>
    set((state) => ({ mcpEndpoints: [...state.mcpEndpoints, endpoint] })),

  removeMcpEndpoint: (id: string) =>
    set((state) => ({
      mcpEndpoints: state.mcpEndpoints.filter((e) => e.id !== id),
    })),

  updateMcpEndpoint: (id: string, updates: Partial<MCPEndpoint>) =>
    set((state) => ({
      mcpEndpoints: state.mcpEndpoints.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
    })),

  setTheme: (theme: Theme) => set({ theme }),

  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'dark' ? 'light' : 'dark',
    })),

  setIsOnline: (isOnline: boolean) => set({ isOnline }),

  reset: () => set(initialState),
}));
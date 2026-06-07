import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as api from '../services/api';
import { useAppStore } from '../store/appStore';

const AGENTS_QUERY_KEY = ['agents'] as const;

export function useAgents() {
  const queryClient = useQueryClient();
  const setAgents = useAppStore((s) => s.setAgents);
  const addAgent = useAppStore((s) => s.addAgent);
  const removeAgent = useAppStore((s) => s.removeAgent);

  const query = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: api.fetchAgents,
    refetchInterval: 30000,
    retry: 3,
    staleTime: 10000,
  });

  useEffect(() => {
    if (query.data) {
      setAgents(query.data);
    }
  }, [query.data, setAgents]);

  const createMutation = useMutation({
    mutationFn: api.createAgent,
    onSuccess: (agent) => {
      addAgent(agent);
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteAgent,
    onSuccess: (_data, agentId) => {
      removeAgent(agentId);
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });

  const updateWorkspaceMutation = useMutation({
    mutationFn: ({
      agentId,
      workspace,
    }: {
      agentId: string;
      workspace: Partial<api.Agent['workspace']>;
    }) => api.updateAgentWorkspace(agentId, workspace),
    onSuccess: (agent) => {
      useAppStore.getState().updateAgent(agent.id, agent);
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });

  const resetMemoryMutation = useMutation({
    mutationFn: api.resetAgentMemory,
  });

  return {
    agents: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    createAgent: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    deleteAgent: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    updateWorkspace: updateWorkspaceMutation.mutateAsync,
    isUpdatingWorkspace: updateWorkspaceMutation.isPending,
    resetMemory: resetMemoryMutation.mutateAsync,
    isResettingMemory: resetMemoryMutation.isPending,
  };
}

export function useAgent(id: string) {
  const query = useQuery({
    queryKey: [...AGENTS_QUERY_KEY, id],
    queryFn: () => api.fetchAgent(id),
    retry: 3,
    staleTime: 5000,
  });

  return {
    agent: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
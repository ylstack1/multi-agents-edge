import { useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import type { Message } from '../services/api';

export function useChat(agentId: string) {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const messagesEndRef = useRef<{ scrollToEnd: () => void } | null>(null);

  const CONVERSATION_KEY = ['conversation', agentId, conversationId] as const;

  const query = useQuery({
    queryKey: CONVERSATION_KEY,
    queryFn: () => {
      if (!conversationId) return [];
      return api.fetchConversation(agentId, conversationId);
    },
    enabled: !!conversationId,
    refetchInterval: false,
    staleTime: Infinity,
  });

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isSending) return;

      setIsSending(true);
      setStreamingContent('...');

      // Optimistically add user message
      const tempUserMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString(),
        agentId,
      };

      queryClient.setQueryData<Message[]>(CONVERSATION_KEY, (old) => [
        ...(old ?? []),
        tempUserMessage,
      ]);

      try {
        const result = await api.sendMessage(
          agentId,
          content.trim(),
          conversationId
        );

        if (!conversationId && result.conversationId) {
          setConversationId(result.conversationId);
        }

        // Add the assistant response
        queryClient.setQueryData<Message[]>(
          ['conversation', agentId, result.conversationId],
          (old) => [
            ...(old ?? []).filter((m) => m.id !== tempUserMessage.id),
            tempUserMessage,
            {
              ...result.message,
              id: result.message.id || `msg-${Date.now()}`,
            },
          ]
        );

        if (!conversationId) {
          setConversationId(result.conversationId);
        }
      } catch (error) {
        // Remove the optimistic message on failure
        queryClient.setQueryData<Message[]>(CONVERSATION_KEY, (old) =>
          (old ?? []).filter((m) => m.id !== tempUserMessage.id)
        );
        throw error;
      } finally {
        setIsSending(false);
        setStreamingContent(null);
      }
    },
    [agentId, conversationId, isSending, queryClient]
  );

  const clearConversation = useCallback(() => {
    setConversationId(undefined);
    queryClient.removeQueries({ queryKey: ['conversation', agentId] });
  }, [agentId, queryClient]);

  return {
    messages: query.data ?? [],
    isLoading: query.isLoading,
    isSending,
    streamingContent,
    conversationId,
    sendMessage,
    clearConversation,
    messagesEndRef,
  };
}
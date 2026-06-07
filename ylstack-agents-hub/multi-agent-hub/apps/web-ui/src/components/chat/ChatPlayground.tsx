import React, { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWorkspaceStore, type ChatMessage } from "@/store/workspaceStore";
import { useSendChat } from "@/hooks/useVFSClient";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { PromptInspector } from "@/components/sandbox/PromptInspector";
import { generateId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Bot,
  MessageSquare,
  Eye,
  EyeOff,
  Terminal,
  ChevronDown,
  Star,
} from "lucide-react";

export function ChatPlayground() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const agents = useWorkspaceStore((s) => s.agents);
  const getChatMessages = useWorkspaceStore((s) => s.getChatMessages);
  const addChatMessage = useWorkspaceStore((s) => s.addChatMessage);
  const clearChatMessages = useWorkspaceStore((s) => s.clearChatMessages);
  const setActiveAgentId = useWorkspaceStore((s) => s.setActiveAgentId);

  const [selectedAgentId, setSelectedAgentId] = useState(
    agentId || "lead",
  );

  const chatMessages = getChatMessages(selectedAgentId);
  const [showInspector, setShowInspector] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);

  const sendChatMutation = useSendChat();

  useEffect(() => {
    if (agentId) {
      setSelectedAgentId(agentId);
      setActiveAgentId(agentId);
    }
  }, [agentId, setActiveAgentId]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const handleSend = useCallback(
    async (message: string) => {
      if (!selectedAgentId || isLoading) return;

      // Add user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: message,
        timestamp: Date.now(),
      };
      addChatMessage(selectedAgentId, userMessage);

      // Send to API
      setIsLoading(true);
      try {
        const response = await sendChatMutation.mutateAsync({
          agentId: selectedAgentId,
          message,
        });

        const assistantMessage: ChatMessage = {
          id: response.id || generateId(),
          role: "assistant",
          content: response.message,
          timestamp: Date.now(),
          toolCalls: response.toolCalls,
          reasoning: response.reasoning,
        };
        addChatMessage(selectedAgentId, assistantMessage);
      } catch (err) {
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: "system",
          content: `Error: ${(err as Error).message}`,
          timestamp: Date.now(),
        };
        addChatMessage(selectedAgentId, errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedAgentId, isLoading, addChatMessage, sendChatMutation],
  );

  const handleClearChat = useCallback(() => {
    clearChatMessages(selectedAgentId);
  }, [clearChatMessages, selectedAgentId]);

  const handleGenerateCurl = useCallback(() => {
    if (!selectedAgentId) return;
    const currentMessages = getChatMessages(selectedAgentId);
    const lastMessage = currentMessages
      .filter((m) => m.role === "user")
      .pop();
    if (!lastMessage) return;

    const curlCmd = `curl -X POST http://localhost:8787/api/chat \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(
    {
      agentId: selectedAgentId,
      message: lastMessage.content,
    },
    null,
    2,
  )}'`;

    navigator.clipboard.writeText(curlCmd).catch(() => {});
  }, [selectedAgentId, getChatMessages]);

  // Build compiled prompt for inspector
  const compiledPrompt = selectedMessageId
    ? chatMessages.find((m) => m.id === selectedMessageId)
    : chatMessages.length > 0
      ? chatMessages[chatMessages.length - 1]
      : undefined;

  return (
    <div className="flex h-full gap-4">
      {/* Chat panel */}
      <div
        className={cn(
          "flex flex-col",
          showInspector ? "w-1/2" : "flex-1",
        )}
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare size={18} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Chat
            </h2>

            {/* Agent selector */}
            <div className="relative">
              <button
                onClick={() => setShowAgentDropdown((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Bot size={14} className="text-blue-400" />
                {selectedAgent?.name ?? "Select Agent"}
                {selectedAgent?.id === "lead" && (
                  <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary">
                    Lead
                  </span>
                )}
                <ChevronDown size={12} />
              </button>
              {showAgentDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowAgentDropdown(false)}
                  />
                  <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-lg">
                    {agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => {
                          setSelectedAgentId(agent.id);
                          setActiveAgentId(agent.id);
                          setShowAgentDropdown(false);
                          navigate(`/chat/${agent.id}`);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors",
                          agent.id === selectedAgentId
                            ? "bg-accent text-accent-foreground"
                            : "text-popover-foreground hover:bg-accent",
                        )}
                      >
                        <Bot size={12} />
                        <span className="flex-1 truncate">{agent.name}</span>
                        {agent.id === "lead" && (
                          <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary">
                            Lead
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowInspector((prev) => !prev)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                showInspector
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              title="Toggle prompt inspector"
            >
              {showInspector ? <EyeOff size={14} /> : <Eye size={14} />}
              Prompt
            </button>
            <button
              onClick={handleGenerateCurl}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Copy as curl command"
            >
              <Terminal size={14} />
              cURL
            </button>
            <button
              onClick={handleClearChat}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden rounded-lg border border-border bg-card">
          <MessageList messages={chatMessages} isLoading={isLoading} />
        </div>

        {/* Input */}
        <div className="mt-3">
          <ChatInput
            onSend={handleSend}
            isLoading={isLoading}
            disabled={!selectedAgentId}
            placeholder={
              selectedAgentId
                ? "Type a message..."
                : "Select an agent to start chatting"
            }
          />
        </div>
      </div>

      {/* Prompt inspector panel */}
      {showInspector && (
        <div className="w-1/2 overflow-hidden rounded-lg border border-border bg-card">
          <PromptInspector
            message={compiledPrompt ?? null}
            agentName={selectedAgent?.name ?? "Unknown"}
            onClose={() => setShowInspector(false)}
          />
        </div>
      )}
    </div>
  );
}
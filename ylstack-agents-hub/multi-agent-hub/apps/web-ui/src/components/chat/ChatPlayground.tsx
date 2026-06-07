import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWorkspaceStore, type ChatMessage } from "@/store/workspaceStore";
import { useSendChat, useAgents } from "@/hooks/useVFSClient";
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
  Plus,
  X,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

type MobileTab = "chat" | "prompt" | "agents";

/** SSE streaming types from backend */
interface StreamChunk {
  type: "text" | "reasoning" | "tool_call" | "done" | "error" | "meta";
  content?: string;
  reasoning?: string;
  toolCallId?: string;
  toolName?: string;
  arguments?: string;
  error?: string;
  provider?: string;
  model?: string;
}

export function ChatPlayground() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const agents = useWorkspaceStore((s) => s.agents);
  const getChatMessages = useWorkspaceStore((s) => s.getChatMessages);
  const addChatMessage = useWorkspaceStore((s) => s.addChatMessage);
  const clearChatMessages = useWorkspaceStore((s) => s.clearChatMessages);
  const newChatSession = useWorkspaceStore((s) => s.newChatSession);
  const setActiveAgentId = useWorkspaceStore((s) => s.setActiveAgentId);
  const setChatMessages = useWorkspaceStore((s) => s.setChatMessages);

  // Auto-refresh agents list from API
  useAgents();

  const [selectedAgentId, setSelectedAgentId] = useState(
    agentId || "lead",
  );

  const chatMessages = getChatMessages(selectedAgentId);
  const [showInspector, setShowInspector] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  /** Ref to the in-progress assistant message being streamed */
  const streamingMsgRef = useRef<ChatMessage | null>(null);
  /** Combined reasoning text being accumulated during streaming */
  const streamingReasoningRef = useRef("");

  const sendChatMutation = useSendChat();

  useEffect(() => {
    if (agentId) {
      setSelectedAgentId(agentId);
      setActiveAgentId(agentId);
    }
  }, [agentId, setActiveAgentId]);

  useEffect(() => {
    if (mobileTab === "chat") {
      setShowInspector(false);
    }
  }, [mobileTab]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  /** Update the streaming message in place (replace the last assistant message) */
  const updateStreamingMessage = useCallback(
    (content: string, reasoning?: string, toolCalls?: any[]) => {
      const current = getChatMessages(selectedAgentId);
      const idx = current.findIndex((m) => m.id === streamingMsgRef.current?.id);
      if (idx === -1) return;
      const updated = [...current];
      updated[idx] = {
        ...updated[idx],
        content,
        ...(reasoning !== undefined ? { reasoning } : {}),
        ...(toolCalls !== undefined ? { toolCalls } : {}),
      };
      setChatMessages(updated, selectedAgentId);
    },
    [getChatMessages, selectedAgentId, setChatMessages],
  );

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
      setIsLoading(true);

      if (selectedAgentId === "lead") {
        // Lead agent: use non-streaming (LeadWorkflow doesn't support streaming)
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
          addChatMessage(selectedAgentId, {
            id: generateId(),
            role: "system",
            content: `Error: ${(err as Error).message}`,
            timestamp: Date.now(),
          });
        }
      } else {
        // Sub-agent: use SSE streaming
        await streamChat(selectedAgentId, message);
      }

      setIsLoading(false);
    },
    [selectedAgentId, isLoading],
  );

  /** SSE streaming logic for sub-agents */
  const streamChat = async (agentId: string, userMessage: string) => {
    // Create placeholder assistant message
    const msgId = generateId();
    const placeholder: ChatMessage = {
      id: msgId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };
    addChatMessage(agentId, placeholder);
    streamingMsgRef.current = placeholder;
    streamingReasoningRef.current = "";

    try {
      const sessionToken = btoa("lead:WEB_UI");
      const url = `${API_BASE}/chat/${encodeURIComponent(agentId)}/stream`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error(`Stream error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body for streaming");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const chunk: StreamChunk = JSON.parse(data);

              if (chunk.type === "text" && chunk.content) {
                fullContent += chunk.content;
                updateStreamingMessage(fullContent);
              } else if (chunk.type === "reasoning" && chunk.reasoning) {
                streamingReasoningRef.current += chunk.reasoning;
                updateStreamingMessage(fullContent, streamingReasoningRef.current);
              } else if (chunk.type === "tool_call") {
                // Tool calls collected but not used for sub-agents currently
              } else if (chunk.type === "error") {
                throw new Error(chunk.error || "Stream error");
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      }

      // Final update with reasoning if any
      const finalReasoning = streamingReasoningRef.current || undefined;
      if (finalReasoning) {
        updateStreamingMessage(fullContent, finalReasoning);
      }
    } catch (err) {
      // Replace placeholder with error
      const current = getChatMessages(agentId);
      const idx = current.findIndex((m) => m.id === msgId);
      if (idx !== -1) {
        const updated = [...current];
        updated[idx] = {
          ...updated[idx],
          content: `Error: ${(err as Error).message}`,
        };
        setChatMessages(updated, agentId);
      }
    } finally {
      streamingMsgRef.current = null;
      streamingReasoningRef.current = "";
    }
  };

  const handleClearChat = useCallback(() => {
    clearChatMessages(selectedAgentId);
  }, [clearChatMessages, selectedAgentId]);

  const handleNewChat = useCallback(() => {
    newChatSession(selectedAgentId);
  }, [newChatSession, selectedAgentId]);

  // Build compiled prompt for inspector
  const compiledPrompt = selectedMessageId
    ? chatMessages.find((m) => m.id === selectedMessageId)
    : chatMessages.length > 0
      ? chatMessages[chatMessages.length - 1]
      : undefined;

  const agentDropdown = (
    <>
      {showAgentDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowAgentDropdown(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-lg">
            {agents.length === 0 && (
              <p className="px-2 py-3 text-center text-[10px] text-muted-foreground/50">
                No agents yet
              </p>
            )}
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => {
                  setSelectedAgentId(agent.id);
                  setActiveAgentId(agent.id);
                  setShowAgentDropdown(false);
                  setMobileTab("chat");
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
    </>
  );

  return (
    <div className="flex h-full flex-col md:flex-row md:gap-4">
      {/* === Chat Panel === */}
      <div
        className={cn(
          "flex flex-col",
          mobileTab !== "chat" && "hidden md:flex",
          showInspector ? "md:w-1/2" : "flex-1",
        )}
      >
        {/* Agent bar — compact header, fixed */}
        <div className="mb-2 flex shrink-0 items-center justify-between md:mb-3">
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <button
                onClick={() => setShowAgentDropdown((prev) => !prev)}
                className="flex max-w-[160px] items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent sm:max-w-[220px]"
              >
                <Bot size={13} className="shrink-0 text-blue-400" />
                <span className="truncate">{selectedAgent?.name ?? "Select Agent"}</span>
                {selectedAgent?.id === "lead" && (
                  <span className="hidden shrink-0 rounded bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary sm:inline">
                    Lead
                  </span>
                )}
                <ChevronDown size={11} className="shrink-0" />
              </button>
              {agentDropdown}
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={handleNewChat}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="New conversation"
            >
              <Plus size={15} />
            </button>
            <button
              onClick={() => {
                const isMobile = window.innerWidth < 768;
                if (isMobile) {
                  setMobileTab(mobileTab === "prompt" ? "chat" : "prompt");
                } else {
                  setShowInspector((prev) => !prev);
                }
              }}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                mobileTab === "prompt" || showInspector
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              title="Prompt inspector"
            >
              {mobileTab === "prompt" || showInspector ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              onClick={handleClearChat}
              className="rounded-md p-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Clear all messages"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Messages — scrollable, fills remaining space */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card scrollbar-thin">
          <MessageList messages={chatMessages} isLoading={isLoading} />
        </div>

        {/* Input — fixed at bottom */}
        <div className="mt-2 shrink-0 sm:mt-3">
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

      {/* === Prompt Inspector — desktop side panel === */}
      {showInspector && (
        <div className="hidden h-full overflow-hidden rounded-lg border border-border bg-card md:block md:w-1/2">
          <PromptInspector
            message={compiledPrompt ?? null}
            agentName={selectedAgent?.name ?? "Unknown"}
            onClose={() => setShowInspector(false)}
          />
        </div>
      )}

      {/* === Prompt Inspector — mobile fullscreen overlay === */}
      {mobileTab === "prompt" && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
            <h3 className="text-sm font-semibold text-foreground">Prompt Inspector</h3>
            <button
              onClick={() => setMobileTab("chat")}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <PromptInspector
              message={compiledPrompt ?? null}
              agentName={selectedAgent?.name ?? "Unknown"}
              onClose={() => setMobileTab("chat")}
            />
          </div>
        </div>
      )}

      {/* === Mobile bottom tab bar — sticky === */}
      <div className="flex shrink-0 items-center justify-around border-t border-border bg-card px-2 py-1.5 md:hidden">
        <button
          onClick={() => setMobileTab("chat")}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-md px-3 py-1 text-[10px] transition-colors",
            mobileTab === "chat"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <MessageSquare size={16} />
          Chat
        </button>
        <button
          onClick={() => setMobileTab("prompt")}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-md px-3 py-1 text-[10px] transition-colors",
            mobileTab === "prompt"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {mobileTab === "prompt" ? <EyeOff size={16} /> : <Eye size={16} />}
          Prompt
        </button>
        <button
          onClick={() => setShowAgentDropdown((prev) => !prev)}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-md px-3 py-1 text-[10px] transition-colors",
            showAgentDropdown
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Bot size={16} />
          Agent
        </button>
        <button
          onClick={handleNewChat}
          className="flex flex-col items-center gap-0.5 rounded-md px-3 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus size={16} />
          New
        </button>
        <button
          onClick={handleClearChat}
          className="flex flex-col items-center gap-0.5 rounded-md px-3 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
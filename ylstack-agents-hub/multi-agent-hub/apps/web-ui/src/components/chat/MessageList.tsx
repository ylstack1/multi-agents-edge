import React, { useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
import { type ChatMessage } from "@/store/workspaceStore";
import { MessageSquare } from "lucide-react";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No messages yet</p>
          <p className="mt-1 text-xs opacity-60">
            Send a message to start chatting with the agent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full space-y-4 overflow-y-auto p-4 scrollbar-thin">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {isLoading && (
        <div className="flex items-center gap-2 pl-11 text-xs text-muted-foreground animate-pulse">
          <span>Agent is thinking</span>
          <span className="flex gap-0.5">
            <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
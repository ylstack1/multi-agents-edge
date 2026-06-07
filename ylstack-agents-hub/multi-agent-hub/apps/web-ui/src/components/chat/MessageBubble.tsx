import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";
import { type ChatMessage } from "@/store/workspaceStore";
import {
  User,
  Bot,
  Cog,
  Terminal,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { formatTimestamp } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
}

const roleConfig = {
  user: {
    icon: User,
    align: "right",
    bg: "bg-primary/10",
    textColor: "text-foreground",
    name: "You",
  },
  assistant: {
    icon: Bot,
    align: "left",
    bg: "bg-muted/50",
    textColor: "text-foreground",
    name: "Assistant",
  },
  system: {
    icon: Cog,
    align: "left",
    bg: "bg-yellow-500/10",
    textColor: "text-yellow-200",
    name: "System",
  },
  tool: {
    icon: Terminal,
    align: "left",
    bg: "bg-blue-500/10",
    textColor: "text-blue-200",
    name: "Tool",
  },
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const config = roleConfig[message.role] ?? roleConfig.assistant;
  const Icon = config.icon;
  const [showReasoning, setShowReasoning] = useState(false);
  const [showToolCalls, setShowToolCalls] = useState(false);

  return (
    <div
      className={cn(
        "flex gap-3",
        config.align === "right" ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          message.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon size={14} />
      </div>

      {/* Content */}
      <div
        className={cn(
          "max-w-[80%] space-y-1",
          config.align === "right" && "items-end",
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground",
            config.align === "right" && "flex-row-reverse",
          )}
        >
          <span className="font-medium">{config.name}</span>
          <span>{formatTimestamp(message.timestamp)}</span>
        </div>

        {/* Message body */}
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            config.bg,
            config.textColor,
          )}
        >
          <ReactMarkdown
            rehypePlugins={[rehypeHighlight]}
            components={{
              pre: ({ children }) => (
                <pre className="my-2 overflow-x-auto rounded-md bg-black/30 p-3 text-xs scrollbar-thin">
                  {children}
                </pre>
              ),
              code: ({ className, children, ...props }) => {
                const isInline = !className;
                if (isInline) {
                  return (
                    <code
                      className="rounded bg-black/20 px-1 py-0.5 text-xs"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Reasoning toggle */}
        {message.reasoning && (
          <div className="pt-1">
            <button
              onClick={() => setShowReasoning((prev) => !prev)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
            >
              {showReasoning ? (
                <ChevronDown size={10} />
              ) : (
                <ChevronRight size={10} />
              )}
              Reasoning
            </button>
            {showReasoning && (
              <div className="mt-1 rounded-md bg-muted/30 p-2 text-[11px] italic text-muted-foreground/70">
                {message.reasoning}
              </div>
            )}
          </div>
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setShowToolCalls((prev) => !prev)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
            >
              {showToolCalls ? (
                <ChevronDown size={10} />
              ) : (
                <ChevronRight size={10} />
              )}
              <span className="rounded bg-blue-500/10 px-1 py-0.5 font-medium text-blue-300">
                {message.toolCalls.length}
              </span>
              tool call{message.toolCalls.length !== 1 ? "s" : ""}
            </button>
            {showToolCalls && (
              <div className="mt-1.5 space-y-2">
                {message.toolCalls.map((tc, idx) => {
                  let parsedArgs: string;
                  try {
                    parsedArgs = JSON.stringify(JSON.parse(tc.arguments), null, 2);
                  } catch {
                    parsedArgs = tc.arguments;
                  }

                  return (
                    <div
                      key={idx}
                      className="overflow-hidden rounded-md border border-blue-500/20 bg-blue-500/5"
                    >
                      {/* Tool header */}
                      <div className="flex items-center gap-1.5 border-b border-blue-500/10 bg-blue-500/10 px-2 py-1.5">
                        <Terminal size={10} className="text-blue-300" />
                        <span className="font-medium text-blue-200">
                          {tc.name}
                        </span>
                      </div>

                      {/* Arguments */}
                      {tc.arguments && tc.arguments !== "{}" && (
                        <details className="group" open>
                          <summary className="flex cursor-pointer items-center gap-1 border-b border-blue-500/5 px-2 py-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground">
                            <ChevronRight size={10} className="transition-transform group-open:rotate-90" />
                            Arguments
                          </summary>
                          <pre className="overflow-x-auto p-2 text-[10px] leading-relaxed text-muted-foreground/70 scrollbar-thin">
                            {parsedArgs}
                          </pre>
                        </details>
                      )}

                      {/* Result */}
                      {tc.result && (
                        <details className="group">
                          <summary className="flex cursor-pointer items-center gap-1 border-b border-green-500/5 px-2 py-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground">
                            <ChevronRight size={10} className="transition-transform group-open:rotate-90" />
                            Result
                          </summary>
                          <pre className="overflow-x-auto p-2 text-[10px] leading-relaxed text-green-300/80 scrollbar-thin">
                            {tc.result.length > 500
                              ? tc.result.slice(0, 500) + "\n… (truncated)"
                              : tc.result}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
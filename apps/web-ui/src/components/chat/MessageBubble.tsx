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

/** Extract  tags from content, returning { cleaned, thinkContent } */
function extractThinkTag(content: string): { cleaned: string; thinkContent: string | null } {
  const match = content.match(/<think>([\s\S]*?)<\/think>/);
  if (!match) return { cleaned: content, thinkContent: null };
  return {
    cleaned: content.replace(/<think>[\s\S]*?<\/think>/g, "").trim(),
    thinkContent: (match[1] ?? "").trim(),
  };
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const config = roleConfig[message.role] ?? roleConfig.assistant;
  const Icon = config.icon;
  const [showReasoning, setShowReasoning] = useState(false);
  const [showToolCalls, setShowToolCalls] = useState(false);

  // Parse think tags from content
  const { cleaned: displayContent, thinkContent } = extractThinkTag(message.content);
  const reasoningText = message.reasoning || thinkContent;
  const isStreaming = message.content === "" && reasoningText === null;

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

        {/* Reasoning toggle — show if reasoning text exists */}
        {reasoningText && (
          <div>
            <button
              onClick={() => setShowReasoning((prev) => !prev)}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
            >
              {showReasoning ? (
                <ChevronDown size={10} />
              ) : (
                <ChevronRight size={10} />
              )}
              <span className="rounded bg-amber-500/10 px-1 py-0.5 font-medium text-amber-400">
                {showReasoning ? "Hide" : "View"}
              </span>
              thinking
              <span className="text-[9px] text-muted-foreground/40">
                {reasoningText.length > 80
                  ? reasoningText.slice(0, 80).replace(/\s+\S*$/, "") + "…"
                  : reasoningText}
              </span>
            </button>
            {showReasoning && (
              <div className="mt-1.5 rounded-md border border-amber-500/15 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-muted-foreground/80 scrollbar-thin max-h-48 overflow-y-auto">
                {reasoningText}
              </div>
            )}
          </div>
        )}

        {/* Message body — only show if there's display content */}
        {(displayContent || isStreaming) && (
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
              {displayContent || (isStreaming ? "..." : "")}
            </ReactMarkdown>
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
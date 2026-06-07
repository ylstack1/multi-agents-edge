import React from "react";
import { type ChatMessage } from "@/store/workspaceStore";
import { X, Copy, Check } from "lucide-react";
import { useState } from "react";

interface PromptInspectorProps {
  message: ChatMessage | null;
  agentName: string;
  onClose: () => void;
}

export function PromptInspector({
  message,
  agentName,
  onClose,
}: PromptInspectorProps) {
  const [copied, setCopied] = useState(false);

  const payload = message
    ? {
        agentId: "current",
        message: message.content,
        timestamp: message.timestamp,
        role: message.role,
      }
    : null;

  const jsonText = payload
    ? JSON.stringify(payload, null, 2)
    : "// No message selected\n// Send a message to see the compiled prompt payload.";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No-op
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">
            Prompt Inspector
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {agentName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Copy payload"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Close inspector"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Payload */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
          {jsonText}
        </pre>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground/60">
          This shows the compiled prompt that will be sent to the AI provider.
        </span>
      </div>
    </div>
  );
}
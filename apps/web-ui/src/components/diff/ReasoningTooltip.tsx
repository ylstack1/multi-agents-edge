import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Lightbulb, X } from "lucide-react";

interface ReasoningTooltipProps {
  reasoning: string;
  agentName?: string;
  className?: string;
}

export function ReasoningTooltip({
  reasoning,
  agentName,
  className,
}: ReasoningTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-yellow-400/70 transition-colors hover:bg-yellow-500/10 hover:text-yellow-300"
        title="View agent reasoning"
      >
        <Lightbulb size={12} />
        Reasoning
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full z-40 mt-1 w-72 rounded-lg border border-border bg-popover p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                Agent Reasoning
                {agentName && (
                  <span className="ml-1 text-muted-foreground">
                    ({agentName})
                  </span>
                )}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X size={12} />
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {reasoning}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
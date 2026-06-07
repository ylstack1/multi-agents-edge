import React from "react";
import { cn } from "@/lib/utils";
import { XCircle, Clock } from "lucide-react";

interface ErrorHighlightProps {
  type: "error" | "timeout";
  message?: string;
  duration?: number;
  className?: string;
}

export function ErrorHighlight({
  type,
  message,
  duration,
  className,
}: ErrorHighlightProps) {
  const isError = type === "error";

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border p-2",
        isError
          ? "border-red-500/30 bg-red-500/10"
          : "border-yellow-500/30 bg-yellow-500/10",
        className,
      )}
    >
      {isError ? (
        <XCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
      ) : (
        <Clock size={14} className="mt-0.5 shrink-0 text-yellow-400" />
      )}
      <div className="min-w-0">
        <p
          className={cn(
            "text-xs font-medium",
            isError ? "text-red-300" : "text-yellow-300",
          )}
        >
          {isError ? "Execution Error" : "Timeout"}
        </p>
        {message && (
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
            {message}
          </p>
        )}
        {duration !== undefined && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/60">
            Duration: {(duration / 1000).toFixed(2)}s
          </p>
        )}
      </div>
    </div>
  );
}
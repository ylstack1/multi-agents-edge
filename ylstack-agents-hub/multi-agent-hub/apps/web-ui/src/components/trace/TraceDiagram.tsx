import React, { useState } from "react";
import { useTrace } from "@/hooks/useVFSClient";
import { TraceNode } from "./TraceNode";
import { cn } from "@/lib/utils";
import {
  Activity,
  Search,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface TraceDiagramProps {
  sessionId?: string;
  className?: string;
}

export function TraceDiagram({ sessionId, className }: TraceDiagramProps) {
  const [inputValue, setInputValue] = useState(sessionId ?? "");
  const [activeSessionId, setActiveSessionId] = useState(sessionId ?? "");

  const {
    data: trace,
    isLoading,
    isError,
    error,
    refetch,
  } = useTrace(activeSessionId);

  const handleSearch = () => {
    if (inputValue.trim()) {
      setActiveSessionId(inputValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            Execution Trace
          </span>
        </div>
        {activeSessionId && (
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Refresh trace"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
          </button>
        )}
      </div>

      {/* Session ID input */}
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter session ID..."
            className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-ring"
          />
          <button
            onClick={handleSearch}
            disabled={!inputValue.trim()}
            className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Search size={12} />
            Trace
          </button>
        </div>
      </div>

      {/* Trace content */}
      <div className="p-3">
        {!activeSessionId ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Activity size={32} className="mb-2 opacity-40" />
            <p className="text-xs">
              Enter a session ID to view the execution trace
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : isError ? (
          <div className="rounded-md bg-red-500/10 p-3 text-xs text-red-300">
            Failed to load trace: {(error as Error).message}
          </div>
        ) : trace ? (
          <TraceNode node={trace} depth={0} />
        ) : (
          <div className="py-4 text-center text-xs text-muted-foreground">
            No trace data found for this session.
          </div>
        )}
      </div>
    </div>
  );
}
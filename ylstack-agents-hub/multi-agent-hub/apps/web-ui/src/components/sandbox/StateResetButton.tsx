import React, { useState } from "react";
import { RotateCcw, AlertTriangle, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StateResetButtonProps {
  onReset: () => Promise<void>;
  agentName?: string;
  variant?: "default" | "icon";
}

export function StateResetButton({
  onReset,
  agentName,
  variant = "default",
}: StateResetButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onReset();
      setResetDone(true);
      setTimeout(() => {
        setResetDone(false);
        setShowConfirm(false);
      }, 2000);
    } catch {
      // Error handled by caller
    } finally {
      setIsResetting(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title={`Reset ${agentName ?? "agent"} memory`}
      >
        <RotateCcw size={14} />
      </button>
    );
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <RotateCcw size={12} />
        Reset Memory
      </button>
    );
  }

  return (
    <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2">
      <div className="flex items-center gap-2 text-xs text-red-300">
        <AlertTriangle size={12} />
        <span>
          Reset memory for {agentName ?? "this agent"}? This cannot be undone.
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={handleReset}
          disabled={isResetting || resetDone}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
            resetDone
              ? "bg-green-500/20 text-green-300"
              : "bg-red-500/20 text-red-300 hover:bg-red-500/30",
          )}
        >
          {isResetting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : resetDone ? (
            <Check size={12} />
          ) : (
            <RotateCcw size={12} />
          )}
          {isResetting
            ? "Resetting..."
            : resetDone
              ? "Done"
              : "Confirm Reset"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
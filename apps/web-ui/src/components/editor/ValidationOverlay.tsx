import React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, XCircle, X } from "lucide-react";

interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}

interface ValidationOverlayProps {
  errors: ValidationError[];
  onClose: () => void;
  visible: boolean;
}

export function ValidationOverlay({
  errors,
  onClose,
  visible,
}: ValidationOverlayProps) {
  if (!visible || errors.length === 0) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 max-h-48 overflow-y-auto border-t border-border bg-card/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Validation Issues ({errors.length})
        </span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>
      <div className="space-y-0.5 px-2 py-1.5">
        {errors.map((err, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-start gap-2 rounded px-2 py-1 text-xs",
              err.severity === "error"
                ? "text-red-300"
                : "text-yellow-300",
            )}
          >
            {err.severity === "error" ? (
              <XCircle size={12} className="mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            )}
            <span>
              <span className="font-mono opacity-70">
                L{err.line}:{err.column}
              </span>{" "}
              {err.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
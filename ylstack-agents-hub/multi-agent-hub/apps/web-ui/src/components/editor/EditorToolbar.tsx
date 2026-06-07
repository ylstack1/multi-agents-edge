import React from "react";
import { cn } from "@/lib/utils";
import {
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface EditorToolbarProps {
  activeFile: string;
  files: { name: string; path: string; isDirty: boolean }[];
  onTabChange: (path: string) => void;
  onResetMemory: () => void;
  hasErrors: boolean;
  errorCount: number;
  isSaving?: boolean;
}

const FILE_LABELS: Record<string, string> = {
  "soul.md": "Soul",
  "identity.md": "Identity",
  "user.md": "User",
  "memory.md": "Memory",
  "tools.md": "Tools",
};

export function EditorToolbar({
  activeFile,
  files,
  onTabChange,
  onResetMemory,
  hasErrors,
  errorCount,
  isSaving,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card">
      {/* File tabs */}
      <div className="flex overflow-x-auto scrollbar-thin">
        {files.map((file) => {
          const label = FILE_LABELS[file.name] ?? file.name;
          return (
            <button
              key={file.path}
              onClick={() => onTabChange(file.path)}
              className={cn(
                "relative flex items-center gap-1.5 border-r border-border px-3 py-2 text-xs font-medium transition-colors",
                activeFile === file.path
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {label}
              {file.isDirty && (
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pr-2">
        {/* Validation status */}
        {hasErrors ? (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle size={12} />
            {errorCount} error{errorCount !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle2 size={12} />
            Valid
          </span>
        )}

        {/* Save indicator */}
        {isSaving && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Save size={12} className="animate-pulse" />
            Saving...
          </span>
        )}

        {/* Reset memory */}
        <button
          onClick={onResetMemory}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Reset agent memory"
        >
          <RotateCcw size={12} />
          <span className="hidden sm:inline">Reset Memory</span>
        </button>
      </div>
    </div>
  );
}
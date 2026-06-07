import React from "react";
import { useDiff } from "@/hooks/useVFSClient";
import { LineDiff } from "./LineDiff";
import { cn } from "@/lib/utils";
import { FileCode, GitCompare } from "lucide-react";
import type { DiffEntry } from "@/api/vfsClient";

interface DiffViewerProps {
  agentId: string;
  className?: string;
}

export function DiffViewer({ agentId, className }: DiffViewerProps) {
  const { data: diffs, isLoading, isError, error } = useDiff(agentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md bg-red-500/10 p-3 text-xs text-red-300">
        Failed to load diff: {(error as Error).message}
      </div>
    );
  }

  if (!diffs || diffs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <GitCompare size={32} className="mb-2 opacity-40" />
        <p className="text-xs">No changes detected</p>
        <p className="mt-1 text-[10px] opacity-60">
          Diffs appear when agent workspace files are modified.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {diffs.map((diff) => (
        <DiffFile key={diff.filePath} diff={diff} />
      ))}
    </div>
  );
}

function DiffFile({ diff }: { diff: DiffEntry }) {
  const [collapsed, setCollapsed] = React.useState(false);

  const totalAdds = diff.hunks.reduce(
    (sum, hunk) =>
      sum + hunk.lines.filter((l) => l.type === "add").length,
    0,
  );
  const totalDels = diff.hunks.reduce(
    (sum, hunk) =>
      sum + hunk.lines.filter((l) => l.type === "delete").length,
    0,
  );

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* File header */}
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left transition-colors hover:bg-accent"
      >
        <div className="flex items-center gap-2">
          <FileCode size={14} className="text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            {diff.filePath}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalAdds > 0 && (
            <span className="text-[10px] font-medium text-green-400">
              +{totalAdds}
            </span>
          )}
          {totalDels > 0 && (
            <span className="text-[10px] font-medium text-red-400">
              -{totalDels}
            </span>
          )}
        </div>
      </button>

      {/* Hunks */}
      {!collapsed && (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse">
            <tbody>
              {diff.hunks.map((hunk, hunkIdx) => (
                <React.Fragment key={hunkIdx}>
                  {/* Hunk header */}
                  <tr className="bg-muted/30">
                    <td
                      colSpan={3}
                      className="px-3 py-1 text-[10px] font-mono text-muted-foreground"
                    >
                      @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},
                      {hunk.newLines} @@
                    </td>
                  </tr>
                  {/* Lines */}
                  {hunk.lines.map((line, lineIdx) => (
                    <LineDiff
                      key={lineIdx}
                      line={line}
                      lineIndex={lineIdx}
                    />
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
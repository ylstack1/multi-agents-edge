import React from "react";
import { cn } from "@/lib/utils";
import type { DiffLine } from "@/api/vfsClient";

interface LineDiffProps {
  line: DiffLine;
  lineIndex: number;
}

const lineStyles: Record<
  string,
  { bg: string; prefix: string; textColor: string; gutterBg: string }
> = {
  add: {
    bg: "bg-green-500/10",
    prefix: "+",
    textColor: "text-green-300",
    gutterBg: "bg-green-500/15",
  },
  delete: {
    bg: "bg-red-500/10",
    prefix: "-",
    textColor: "text-red-300",
    gutterBg: "bg-red-500/15",
  },
  context: {
    bg: "bg-transparent",
    prefix: " ",
    textColor: "text-muted-foreground",
    gutterBg: "bg-transparent",
  },
};

export function LineDiff({ line, lineIndex }: LineDiffProps) {
  const style = (lineStyles[line.type] ?? lineStyles.context)!;

  return (
    <tr className={cn("transition-colors hover:brightness-110", style.bg)}>
      {/* Old line number */}
      <td className="w-12 select-none px-2 text-right text-[10px] font-mono text-muted-foreground/50">
        {line.oldLineNumber ?? ""}
      </td>
      {/* New line number */}
      <td
        className={cn(
          "w-12 select-none px-2 text-right text-[10px] font-mono",
          line.type === "add"
            ? "text-green-400/60"
            : line.type === "delete"
              ? "text-red-400/60"
              : "text-muted-foreground/50",
        )}
      >
        {line.newLineNumber ?? ""}
      </td>
      {/* Content */}
      <td
        className={cn(
          "px-3 py-[1px] text-[11px] font-mono leading-relaxed",
          style.textColor,
        )}
      >
        <span
          className={cn(
            "mr-2 select-none",
            line.type === "add" && "text-green-400",
            line.type === "delete" && "text-red-400",
          )}
        >
          {style.prefix}
        </span>
        {line.content || "\u00A0"}
      </td>
    </tr>
  );
}
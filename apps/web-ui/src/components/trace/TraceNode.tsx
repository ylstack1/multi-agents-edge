import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ErrorHighlight } from "./ErrorHighlight";
import {
  Bot,
  Wrench,
  Brain,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { TraceNodeDto } from "@/api/vfsClient";

interface TraceNodeProps {
  node: TraceNodeDto;
  depth?: number;
}

const nodeIcons: Record<string, React.ElementType> = {
  agent: Bot,
  tool: Wrench,
  llm: Brain,
  error: AlertCircle,
};

const nodeColors: Record<string, string> = {
  agent: "text-blue-400 border-blue-500/30",
  tool: "text-purple-400 border-purple-500/30",
  llm: "text-green-400 border-green-500/30",
  error: "text-red-400 border-red-500/30",
};

const statusDots: Record<string, string> = {
  success: "bg-green-400",
  error: "bg-red-400",
  running: "bg-yellow-400 animate-pulse",
};

export function TraceNode({ node, depth = 0 }: TraceNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const Icon = nodeIcons[node.type] ?? Bot;
  const hasChildren = node.children && node.children.length > 0;

  const handleToggle = () => {
    if (hasChildren) {
      setExpanded((prev) => !prev);
    }
  };

  return (
    <div className="select-none">
      {/* Node row */}
      <div
        className={cn(
          "group flex items-center gap-2 rounded-md border px-3 py-2 transition-colors hover:brightness-110",
          nodeColors[node.type] ?? "border-border",
          node.status === "error" && "border-red-500/50",
          node.status === "running" && "border-yellow-500/50",
        )}
        style={{ marginLeft: `${depth * 20}px` }}
      >
        {/* Expand/collapse */}
        <button
          onClick={handleToggle}
          className={cn(
            "rounded p-0.5 text-muted-foreground transition-colors",
            hasChildren
              ? "opacity-100 hover:bg-accent hover:text-foreground"
              : "opacity-0",
          )}
          disabled={!hasChildren}
        >
          {expanded ? (
            <ChevronDown size={12} />
          ) : (
            <ChevronRight size={12} />
          )}
        </button>

        {/* Icon */}
        <Icon size={14} className="shrink-0" />

        {/* Label */}
        <span className="flex-1 text-xs font-medium text-foreground">
          {node.label}
        </span>

        {/* Status dot */}
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            statusDots[node.status] ?? "bg-muted-foreground",
          )}
        />

        {/* Duration */}
        {node.duration !== undefined && (
          <span className="text-[10px] text-muted-foreground/60">
            {(node.duration / 1000).toFixed(2)}s
          </span>
        )}
      </div>

      {/* Error details */}
      {node.error && (
        <div
          className="ml-4 mt-1"
          style={{ marginLeft: `${depth * 20 + 16}px` }}
        >
          <ErrorHighlight
            type="error"
            message={node.error}
            duration={node.duration}
          />
        </div>
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {(node.children as TraceNodeDto[]).map((child) => (
            <TraceNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
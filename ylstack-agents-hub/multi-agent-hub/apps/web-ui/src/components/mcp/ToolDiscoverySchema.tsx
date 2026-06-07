import React, { useState } from "react";
import { useWorkspaceStore, type McpEndpoint, type McpTool } from "@/store/workspaceStore";
import { useDiscoverTools } from "@/hooks/useVFSClient";
import { cn } from "@/lib/utils";
import {
  Puzzle,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  Code,
  BookOpen,
} from "lucide-react";

export function ToolDiscoverySchema() {
  const endpoints = useWorkspaceStore((s) => s.mcpEndpoints);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const discoverMutation = useDiscoverTools();

  const selectedEndpoint = endpoints.find(
    (e) => e.id === selectedEndpointId,
  );

  const handleDiscover = async () => {
    if (!selectedEndpointId) return;
    try {
      const tools = await discoverMutation.mutateAsync(selectedEndpointId);
      const updated = endpoints.map((e) =>
        e.id === selectedEndpointId ? { ...e, tools } : e,
      );
      useWorkspaceStore.setState({ mcpEndpoints: updated });
    } catch {
      // Silent
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Puzzle size={14} className="text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            Discovered Tools
          </span>
        </div>
      </div>

      <div className="p-3">
        {/* Endpoint selector */}
        <div className="mb-3">
          <select
            value={selectedEndpointId ?? ""}
            onChange={(e) => setSelectedEndpointId(e.target.value || null)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-ring"
          >
            <option value="">Select an endpoint...</option>
            {endpoints.map((ep) => (
              <option key={ep.id} value={ep.id}>
                {ep.name}
              </option>
            ))}
          </select>

          {selectedEndpointId && (
            <button
              onClick={handleDiscover}
              disabled={discoverMutation.isPending}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {discoverMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Search size={12} />
              )}
              {discoverMutation.isPending ? "Discovering..." : "Discover Tools"}
            </button>
          )}
        </div>

        {/* Tools list */}
        {selectedEndpoint?.tools && selectedEndpoint.tools.length > 0 ? (
          <div className="space-y-2">
            {selectedEndpoint.tools.map((tool) => (
              <div
                key={tool.name}
                className="rounded-md border border-border bg-background"
              >
                <button
                  onClick={() =>
                    setExpandedTool(
                      expandedTool === tool.name ? null : tool.name,
                    )
                  }
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-accent"
                >
                  {expandedTool === tool.name ? (
                    <ChevronDown size={12} className="text-muted-foreground" />
                  ) : (
                    <ChevronRight size={12} className="text-muted-foreground" />
                  )}
                  <Code size={12} className="text-purple-400" />
                  <span className="text-xs font-medium text-foreground">
                    {tool.name}
                  </span>
                </button>
                {expandedTool === tool.name && (
                  <div className="border-t border-border px-3 py-2">
                    {tool.description && (
                      <div className="mb-2">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <BookOpen size={10} />
                          Description
                        </div>
                        <p className="text-[11px] text-muted-foreground/80">
                          {tool.description}
                        </p>
                      </div>
                    )}
                    {tool.inputSchema && (
                      <div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Code size={10} />
                          Input Schema
                        </div>
                        <pre className="mt-1 max-h-40 overflow-y-auto rounded bg-black/30 p-2 text-[10px] leading-relaxed text-muted-foreground/70 scrollbar-thin">
                          {JSON.stringify(tool.inputSchema, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : selectedEndpointId ? (
          <p className="text-center text-[10px] text-muted-foreground/60">
            {discoverMutation.isPending
              ? "Discovering tools..."
              : "No tools discovered yet. Click 'Discover Tools' to fetch available tools from this endpoint."}
          </p>
        ) : (
          <p className="text-center text-[10px] text-muted-foreground/60">
            Select an endpoint and discover available tools.
          </p>
        )}
      </div>
    </div>
  );
}
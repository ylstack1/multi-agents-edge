import React, { useState } from "react";
import { useWorkspaceStore, type McpEndpoint } from "@/store/workspaceStore";
import { usePingMcpEndpoint, useDiscoverTools } from "@/hooks/useVFSClient";
import { cn } from "@/lib/utils";
import {
  Radio,
  Loader2,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  Search,
} from "lucide-react";

export function DiagnosticPing() {
  const endpoints = useWorkspaceStore((s) => s.mcpEndpoints);
  const updateEndpointStatus = useWorkspaceStore(
    (s) => s.updateEndpointStatus,
  );

  const pingMutation = usePingMcpEndpoint();
  const discoverMutation = useDiscoverTools();

  const [pingResults, setPingResults] = useState<
    Record<string, { latency: number; status: string }>
  >({});
  const [isPingingAll, setIsPingingAll] = useState(false);

  const handlePing = async (endpoint: McpEndpoint) => {
    updateEndpointStatus(endpoint.id, "unknown");
    try {
      const result = await pingMutation.mutateAsync(endpoint.id);
      updateEndpointStatus(endpoint.id, result.status === "ok" ? "online" : "offline");
      setPingResults((prev) => ({
        ...prev,
        [endpoint.id]: { latency: result.latency, status: result.status },
      }));
    } catch {
      updateEndpointStatus(endpoint.id, "offline");
      setPingResults((prev) => ({
        ...prev,
        [endpoint.id]: { latency: 0, status: "error" },
      }));
    }
  };

  const handlePingAll = async () => {
    setIsPingingAll(true);
    for (const endpoint of endpoints) {
      await handlePing(endpoint);
    }
    setIsPingingAll(false);
  };

  const handleDiscover = async (endpoint: McpEndpoint) => {
    try {
      const tools = await discoverMutation.mutateAsync(endpoint.id);
      const updated = endpoints.map((e) =>
        e.id === endpoint.id ? { ...e, tools } : e,
      );
      useWorkspaceStore.setState({ mcpEndpoints: updated });
    } catch {
      // Discovery failed silently
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            Ping &amp; Discover
          </span>
        </div>
        {endpoints.length > 0 && (
          <button
            onClick={handlePingAll}
            disabled={isPingingAll}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {isPingingAll ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Wifi size={12} />
            )}
            Ping All
          </button>
        )}
      </div>

      <div className="p-3">
        {endpoints.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/60">
            No MCP endpoints configured. Add one above to test connectivity.
          </p>
        ) : (
          <div className="space-y-2">
            {endpoints.map((endpoint) => {
              const result = pingResults[endpoint.id];
              return (
                <div
                  key={endpoint.id}
                  className="rounded-md border border-border bg-background p-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-foreground">
                        {endpoint.name}
                      </span>
                      <p className="truncate text-[10px] text-muted-foreground/60">
                        {endpoint.url}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Status indicator */}
                      {endpoint.status === "online" ? (
                        <Wifi size={12} className="text-green-400" />
                      ) : endpoint.status === "offline" ? (
                        <WifiOff size={12} className="text-red-400" />
                      ) : (
                        <Radio size={12} className="text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Ping result */}
                  {result && (
                    <div
                      className={cn(
                        "mt-1 rounded px-1.5 py-0.5 text-[10px]",
                        result.status === "ok" || endpoint.status === "online"
                          ? "bg-green-500/10 text-green-300"
                          : "bg-red-500/10 text-red-300",
                      )}
                    >
                      {result.status === "ok" || endpoint.status === "online"
                        ? `Online (${result.latency.toFixed(0)}ms)`
                        : "Offline / Error"}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-1.5 flex items-center gap-1">
                    <button
                      onClick={() => handlePing(endpoint)}
                      disabled={pingMutation.isPending}
                      className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {pingMutation.isPending &&
                      pingMutation.variables === endpoint.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Wifi size={10} />
                      )}
                      Ping
                    </button>
                    <button
                      onClick={() => handleDiscover(endpoint)}
                      disabled={discoverMutation.isPending}
                      className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {discoverMutation.isPending &&
                      discoverMutation.variables === endpoint.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Search size={10} />
                      )}
                      Discover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
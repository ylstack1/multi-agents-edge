import React, { useState } from "react";
import { useWorkspaceStore, type McpEndpoint } from "@/store/workspaceStore";
import { useAddMcpEndpoint, useDeleteMcpEndpoint } from "@/hooks/useVFSClient";
import {
  Plus,
  Trash2,
  Link,
  Loader2,
  Check,
  X,
} from "lucide-react";

export function EndpointForm() {
  const endpoints = useWorkspaceStore((s) => s.mcpEndpoints);
  const addEndpoint = useWorkspaceStore((s) => s.addEndpoint);
  const removeEndpoint = useWorkspaceStore((s) => s.removeEndpoint);

  const addEndpointMutation = useAddMcpEndpoint();
  const deleteEndpointMutation = useDeleteMcpEndpoint();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    try {
      await addEndpointMutation.mutateAsync({
        name: name.trim(),
        url: url.trim(),
        enabled: true,
      });
      // Also add to local store
      addEndpoint({
        name: name.trim(),
        url: url.trim(),
        enabled: true,
      });
      setName("");
      setUrl("");
      setShowForm(false);
    } catch {
      // If API fails, still add locally
      addEndpoint({
        name: name.trim(),
        url: url.trim(),
        enabled: true,
      });
      setName("");
      setUrl("");
      setShowForm(false);
    }
  };

  const handleRemove = async (endpoint: McpEndpoint) => {
    removeEndpoint(endpoint.id);
    try {
      await deleteEndpointMutation.mutateAsync(endpoint.id);
    } catch {
      // Silently fail
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Link size={14} className="text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            MCP Endpoints
          </span>
        </div>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Cancel" : "Add Endpoint"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-2 border-b border-border p-3"
        >
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production MCP"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-ring"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g., http://localhost:3001/mcp"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-ring"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim() || !url.trim() || addEndpointMutation.isPending}
            className="flex w-full items-center justify-center gap-1 rounded-md bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {addEndpointMutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Plus size={12} />
            )}
            Add Endpoint
          </button>
        </form>
      )}

      {/* Endpoint list */}
      <div className="p-3">
        {endpoints.length === 0 && !showForm ? (
          <p className="text-[10px] text-muted-foreground/60">
            No endpoints configured. Click "Add Endpoint" to add an MCP server.
          </p>
        ) : (
          <div className="space-y-2">
            {endpoints.map((endpoint) => (
              <div
                key={endpoint.id}
                className="flex items-center justify-between rounded-md border border-border bg-background p-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">
                      {endpoint.name}
                    </span>
                    {endpoint.status === "online" && (
                      <Check size={10} className="text-green-400" />
                    )}
                    {endpoint.status === "offline" && (
                      <X size={10} className="text-red-400" />
                    )}
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground/60">
                    {endpoint.url}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(endpoint)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-red-500/20 hover:text-red-400"
                  title="Remove endpoint"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
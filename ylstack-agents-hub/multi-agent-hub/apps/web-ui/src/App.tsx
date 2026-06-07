import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import Dashboard from "@/components/Dashboard";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { ChatPlayground } from "@/components/chat/ChatPlayground";
import { DiagnosticPing } from "@/components/mcp/DiagnosticPing";
import { EndpointForm } from "@/components/mcp/EndpointForm";
import { ToolDiscoverySchema } from "@/components/mcp/ToolDiscoverySchema";
import {
  Settings,
  Moon,
  Sun,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure global application settings.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground">Appearance</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Theme settings are managed via the toggle in the bottom-left of the
          sidebar.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground">API Endpoint</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          The API base URL is configured via the VITE_API_URL environment
          variable. Current:{" "}
          {import.meta.env.VITE_API_URL || "http://localhost:8787"}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground">About</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Multi-Agent Hub Web UI v0.1.0
        </p>
      </div>
    </div>
  );
}

function McpConfigPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          MCP Configuration
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage MCP endpoints, discover tools, and test connectivity.
        </p>
      </div>

      <EndpointForm />

      <div className="grid gap-6 lg:grid-cols-2">
        <DiagnosticPing />
        <ToolDiscoverySchema />
      </div>
    </div>
  );
}

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <PanelRightOpen size={18} />
              ) : (
                <PanelRightClose size={18} />
              )}
            </button>
            <span className="text-sm font-medium text-muted-foreground">
              Multi-Agent Hub
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDark((prev) => !prev)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <main
          className={cn(
            "flex-1 overflow-y-auto p-6",
            "scrollbar-thin",
          )}
        >
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route
                path="/workspace/:agentId"
                element={<MarkdownEditor />}
              />
              <Route path="/chat" element={<ChatPlayground />} />
              <Route
                path="/chat/:agentId"
                element={<ChatPlayground />}
              />
              <Route path="/mcp" element={<McpConfigPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default App;
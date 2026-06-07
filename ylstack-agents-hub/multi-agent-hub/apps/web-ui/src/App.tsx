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
import { Menu, Moon, PanelRightClose, PanelRightOpen, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { useAgents } from "@/hooks/useVFSClient";

/** Fetches agents from API on mount to populate the store */
function AgentLoader({ children }: { children: React.ReactNode }) {
  useAgents();
  return <>{children}</>;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-12 items-center justify-between border-b border-border px-3 sm:px-4">
          <div className="flex items-center gap-2">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
              title="Open menu"
            >
              <Menu size={20} />
            </button>
            {/* Collapse toggle — desktop only */}
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="hidden rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground md:block"
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
            "flex-1 overflow-hidden p-3 sm:p-4 md:p-6",
          )}
        >
          <ErrorBoundary>
            <AgentLoader>
              <Routes>
                <Route path="/" element={
                  <div className="h-full overflow-y-auto scrollbar-thin"><Dashboard /></div>
                } />
                <Route
                  path="/workspace/:agentId"
                  element={<MarkdownEditor />}
                />
                <Route path="/chat" element={<ChatPlayground />} />
                <Route
                  path="/chat/:agentId"
                  element={<ChatPlayground />}
                />
                <Route path="/mcp" element={
                  <div className="h-full overflow-y-auto scrollbar-thin"><McpConfigPage /></div>
                } />
                <Route path="/settings" element={
                  <div className="h-full overflow-y-auto scrollbar-thin"><SettingsPage /></div>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AgentLoader>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default App;
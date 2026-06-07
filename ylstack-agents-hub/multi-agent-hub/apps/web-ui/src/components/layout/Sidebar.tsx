import React, { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  Puzzle,
  ChevronLeft,
  ChevronRight,
  Bot,
  Circle,
  X,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/mcp", icon: Puzzle, label: "MCP Config" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

const statusColors: Record<string, string> = {
  idle: "text-yellow-400",
  active: "text-green-400",
  error: "text-red-400",
};

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const agents = useWorkspaceStore((s) => s.agents);
  const setActiveAgentId = useWorkspaceStore((s) => s.setActiveAgentId);

  // Close mobile drawer on route change
  useEffect(() => {
    if (mobileOpen) onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const sidebarContent = (
    <>
      {/* Logo / Brand */}
      <div
        className={cn(
          "flex h-12 items-center border-b border-sidebar-border px-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-blue-400" />
            <span className="text-sm font-semibold tracking-tight">
              Multi-Agent Hub
            </span>
          </div>
        )}
        {collapsed && <Bot size={20} className="text-blue-400" />}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                collapsed && "justify-center px-0",
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={18} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {/* Agent List */}
        {!collapsed && (
          <div className="pt-4">
            <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Agents
            </div>
            {agents.length === 0 && (
              <p className="px-2 text-[10px] text-muted-foreground/40">No agents yet</p>
            )}
            {agents.map((agent) => (
              <NavLink
                key={agent.id}
                to={`/workspace/${agent.id}`}
                onClick={() => setActiveAgentId(agent.id)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                    isActive ||
                      location.pathname.includes(`/workspace/${agent.id}`)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )
                }
              >
                <Circle
                  size={6}
                  className={cn(
                    "shrink-0 fill-current",
                    statusColors[agent.status] ?? "text-gray-400",
                  )}
                />
                <span className="truncate">{agent.name}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Collapse toggle — desktop only */}
      <div className="hidden border-t border-sidebar-border p-2 md:block">
        <button
          onClick={onToggleCollapse}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "justify-center",
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-300 md:static md:z-auto md:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
          collapsed && "md:w-14",
        )}
      >
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="absolute right-2 top-3 rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"
          title="Close menu"
        >
          <X size={18} />
        </button>

        {sidebarContent}
      </aside>
    </>
  );
}
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspaceStore, type Agent } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";
import {
  Bot,
  Plus,
  Activity,
  Users,
  AlertCircle,
  Clock,
  MessageSquare,
  FileText,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const statusConfig: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  idle: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    label: "Idle",
  },
  active: {
    color: "text-green-400",
    bg: "bg-green-500/10",
    label: "Active",
  },
  error: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    label: "Error",
  },
};

const chartData = [
  { name: "Mon", requests: 12, errors: 1 },
  { name: "Tue", requests: 18, errors: 2 },
  { name: "Wed", requests: 25, errors: 0 },
  { name: "Thu", requests: 15, errors: 3 },
  { name: "Fri", requests: 22, errors: 1 },
  { name: "Sat", requests: 8, errors: 0 },
  { name: "Sun", requests: 5, errors: 1 },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const agents = useWorkspaceStore((s) => s.agents);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const activeCount = agents.filter((a) => a.status === "active").length;
  const errorCount = agents.filter((a) => a.status === "error").length;
  const totalRequests = chartData.reduce((s, d) => s + d.requests, 0);
  const totalErrors = chartData.reduce((s, d) => s + d.errors, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Overview of your agents and system status.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <Plus size={14} />
          New Agent
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Agents"
          value={agents.length}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <StatCard
          icon={Activity}
          label="Active Now"
          value={activeCount}
          color="text-green-400"
          bg="bg-green-500/10"
        />
        <StatCard
          icon={AlertCircle}
          label="Errors"
          value={errorCount}
          color="text-red-400"
          bg="bg-red-500/10"
        />
        <StatCard
          icon={Clock}
          label="Requests (7d)"
          value={totalRequests}
          color="text-purple-400"
          bg="bg-purple-500/10"
        />
      </div>

      {/* Chart and Agents grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity Chart */}
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h3 className="mb-3 text-xs font-medium text-foreground">
            Request Activity (Last 7 Days)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="requests"
                  fill="hsl(var(--primary))"
                  radius={[3, 3, 0, 0]}
                  opacity={0.8}
                />
                <Bar
                  dataKey="errors"
                  fill="hsl(var(--destructive))"
                  radius={[3, 3, 0, 0]}
                  opacity={0.6}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-medium text-foreground">
            Recent Activity
          </h3>
          <div className="space-y-2">
            {agents.slice(0, 5).map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-2 rounded-md bg-muted/30 p-2"
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    agent.status === "active"
                      ? "bg-green-400"
                      : agent.status === "error"
                        ? "bg-red-400"
                        : "bg-yellow-400",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-foreground">
                    {agent.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {agent.status === "active"
                      ? "Processing..."
                      : agent.status === "error"
                        ? "Error occurred"
                        : "Waiting"}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground/50">
                  {formatRelativeTime(agent.lastActive)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Cards */}
      <div>
        <h3 className="mb-3 text-xs font-medium text-foreground">
          All Agents
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onOpen={() => navigate(`/workspace/${agent.id}`)}
              onChat={() => navigate(`/chat/${agent.id}`)}
            />
          ))}
        </div>
      </div>

      {/* Create Agent Modal */}
      {showCreateModal && (
        <CreateAgentModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  bg: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className={cn("rounded-md p-1.5", bg)}>
          <Icon size={16} className={color} />
        </div>
        <span className="text-lg font-bold text-foreground">{value}</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

interface AgentCardProps {
  agent: Agent;
  onOpen: () => void;
  onChat: () => void;
}

function AgentCard({ agent, onOpen, onChat }: AgentCardProps) {
  const config = (statusConfig[agent.status] ?? statusConfig.idle)!;

  return (
    <div className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/30">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md",
              config.bg,
            )}
          >
            <Bot size={16} className={config.color} />
          </div>
          <div>
            <h4 className="text-xs font-medium text-foreground">
              {agent.name}
            </h4>
            <p className="text-[10px] text-muted-foreground">
              {agent.description}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
            config.bg,
            config.color,
          )}
        >
          {config.label}
        </span>
      </div>

      {/* Time */}
      <p className="mt-2 text-[10px] text-muted-foreground/50">
        Last active: {formatRelativeTime(agent.lastActive)}
      </p>

      {/* Actions */}
      <div className="mt-2 flex items-center gap-1">
        <button
          onClick={onOpen}
          className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <FileText size={10} />
          Workspace
        </button>
        <button
          onClick={onChat}
          className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <MessageSquare size={10} />
          Chat
        </button>
      </div>
    </div>
  );
}

function CreateAgentModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [name, setName] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    const agents = useWorkspaceStore.getState().agents;
    const newAgent: Agent = {
      id: String(agents.length + 1),
      name: name.trim(),
      status: "idle",
      description: "Custom agent",
      lastActive: Date.now(),
    };
    useWorkspaceStore.setState({ agents: [...agents, newAgent] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg">
        <h2 className="mb-1 text-sm font-semibold text-foreground">
          Create New Agent
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Enter a name for the new agent.
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Agent name"
          className="mb-3 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-ring"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
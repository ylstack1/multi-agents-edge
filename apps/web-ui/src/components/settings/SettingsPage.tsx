import React, { useState, useEffect, useCallback } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Brain,
  Puzzle,
  Bot,
  Github,
  Zap,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  RefreshCw,
  Globe,
  Key,
  Sliders,
  Webhook,
  MessageSquare,
  ExternalLink,
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as api from "@/api/vfsClient";

// ── Tab Definitions ──────────────────────────────────────────────

const TABS = [
  { id: "general", label: "General", icon: Sliders },
  { id: "providers", label: "Providers", icon: Brain },
  { id: "marketplace", label: "Marketplace", icon: Box },
  { id: "integrations", label: "Integrations", icon: Puzzle },
  { id: "telegram", label: "Telegram", icon: Bot },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Reusable UI Components ───────────────────────────────────────

function Section({ title, description, children }: { title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="space-y-0.5">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        enabled ? "bg-green-500" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
          enabled ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline,
  className,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && <label className="text-xs font-medium text-foreground/80">{label}</label>}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[60px] resize-y"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      )}
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
      ok ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500",
    )}>
      {ok ? <Check size={10} /> : <X size={10} />}
      {label || (ok ? "Connected" : "Not configured")}
    </span>
  );
}

function SaveButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
      {loading ? "Saving..." : "Save"}
    </button>
  );
}

function ActionButton({ onClick, icon, label, variant = "default", disabled }: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: "default" | "danger" | "secondary";
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "danger" && "bg-red-500/10 text-red-500 hover:bg-red-500/20",
        variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Spinner() {
  return <Loader2 size={16} className="animate-spin text-muted-foreground" />;
}

// ── Main Settings Page ───────────────────────────────────────────

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // State
  const [defaultProvider, setDefaultProvider] = useState("workers-ai");
  const [defaultModel, setDefaultModel] = useState("@cf/meta/llama-3.2-3b-instruct");
  const [defaultTemperature, setDefaultTemperature] = useState(0.7);
  const [defaultMaxTokens, setDefaultMaxTokens] = useState(4096);
  const [appName, setAppName] = useState("Multi-Agent Hub");

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  // ── General Tab ──────────────────────────────────────

  function GeneralTab() {
    return (
      <div className="space-y-4">
        <Section title="General Settings" description="Configure global application defaults">
          <InputField
            label="Application Name"
            value={appName}
            onChange={setAppName}
          />

          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Default Provider"
              value={defaultProvider}
              onChange={setDefaultProvider}
              placeholder="workers-ai"
            />
            <InputField
              label="Default Model"
              value={defaultModel}
              onChange={setDefaultModel}
              placeholder="@cf/meta/llama-3.2-3b-instruct"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Temperature"
              value={String(defaultTemperature)}
              onChange={(v) => setDefaultTemperature(parseFloat(v) || 0.7)}
              type="number"
              placeholder="0.7"
            />
            <InputField
              label="Max Tokens"
              value={String(defaultMaxTokens)}
              onChange={(v) => setDefaultMaxTokens(parseInt(v) || 4096)}
              type="number"
              placeholder="4096"
            />
          </div>

          <div className="flex justify-end pt-2">
            <SaveButton
              loading={saving}
              onClick={handleSaveGeneral}
            />
          </div>
        </Section>

        <Section title="About">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Multi-Agent Hub v0.1.0</p>
            <p>Powered by Cloudflare Workers + Workers AI</p>
            <p>Settings are persisted in KV store</p>
          </div>
        </Section>
      </div>
    );
  }

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      const existing = await api.getSettings();
      await api.saveSettings({
        ...existing,
        defaultProvider,
        defaultModel,
        defaultTemperature,
        defaultMaxTokens,
        appName,
      });
      showSuccess("General settings saved");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // ── Providers Tab ─────────────────────────────────────

  function ProvidersTab() {
    const [providers, setProviders] = useState<api.ProviderInfo[]>([]);
    const [loadingProviders, setLoadingProviders] = useState(true);
    const [editingProvider, setEditingProvider] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{
      apiKey: string;
      baseUrl: string;
      defaultModel: string;
      enabled: boolean;
    }>({ apiKey: "", baseUrl: "", defaultModel: "", enabled: true });
    const [testingProviders, setTestingProviders] = useState<Set<string>>(new Set());
    const [testResults, setTestResults] = useState<Record<string, { ok: boolean; latencyMs: number }>>({});
    const [fetchingModels, setFetchingModels] = useState<string | null>(null);
    const [fetchedModels, setFetchedModels] = useState<Record<string, string[]>>({});

    const loadProviders = useCallback(async () => {
      try {
        const data = await api.listProviders();
        setProviders(data);
      } catch (err) {
        console.error("Failed to load providers:", err);
      } finally {
        setLoadingProviders(false);
      }
    }, []);

    useEffect(() => { loadProviders(); }, [loadProviders]);

    const startEdit = (p: api.ProviderInfo) => {
      setEditingProvider(p.provider);
      setEditForm({
        apiKey: "",
        baseUrl: "",
        defaultModel: p.defaultModel || "",
        enabled: p.enabled,
      });
    };

    const saveProvider = async (provider: string) => {
      try {
        await api.updateProvider(provider, editForm);
        showSuccess(`Provider "${provider}" updated`);
        setEditingProvider(null);
        loadProviders();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to update");
      }
    };

    const testProvider = async (provider: string) => {
      setTestingProviders((prev) => new Set(prev).add(provider));
      try {
        const result = await api.testProvider(provider);
        setTestResults((prev) => ({ ...prev, [provider]: result }));
        showSuccess(result.ok ? `Provider "${provider}" responded in ${result.latencyMs}ms` : "Test failed");
      } catch (err) {
        setTestResults((prev) => ({ ...prev, [provider]: { ok: false, latencyMs: 0 } }));
        showError(`${provider}: ${err instanceof Error ? err.message : "Test failed"}`);
      } finally {
        setTestingProviders((prev) => {
          const next = new Set(prev);
          next.delete(provider);
          return next;
        });
      }
    };

    const fetchModels = async (provider: string) => {
      setFetchingModels(provider);
      try {
        const models = await api.fetchProviderModels(provider);
        setFetchedModels((prev) => ({ ...prev, [provider]: models }));
        if (models.length === 0) {
          showError("No models returned from API — check API key");
        } else {
          showSuccess(`Found ${models.length} models for "${provider}"`);
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to fetch models");
      } finally {
        setFetchingModels(null);
      }
    };

    if (loadingProviders) {
      return <div className="flex items-center justify-center py-12"><Spinner /></div>;
    }

    return (
      <div className="space-y-4">
        {providers.map((p) => (
          <Section key={p.provider} title={
            <div className="flex items-center justify-between w-full">
              <span>{p.label || p.provider}</span>
              <div className="flex items-center gap-2">
                <Toggle
                  enabled={p.enabled}
                  onChange={async (v) => {
                    try {
                      await api.updateProvider(p.provider, { enabled: v });
                      showSuccess(`"${p.provider}" ${v ? "enabled" : "disabled"}`);
                      loadProviders();
                    } catch (err) {
                      showError("Failed to toggle provider");
                    }
                  }}
                />
              </div>
            </div>
          } description={
            <span className="flex items-center gap-2">
              {!p.hasApiKey && p.provider !== "workers-ai" && (
                <span className="text-amber-500 text-xs">No API key set</span>
              )}
              {p.hasApiKey && <StatusBadge ok label="Key set" />}
              {p.defaultModel && <span className="text-xs text-muted-foreground">Model: {p.defaultModel}</span>}
              {(() => {
                const tr = testResults[p.provider];
                return tr ? (
                  <StatusBadge
                    ok={tr.ok}
                    label={tr.ok ? `${tr.latencyMs}ms` : "Failed"}
                  />
                ) : null;
              })()}
            </span>
          }>
            {editingProvider === p.provider ? (
              <div className="space-y-3">
                {p.provider !== "workers-ai" && (
                  <InputField
                    label="API Key"
                    value={editForm.apiKey}
                    onChange={(v) => setEditForm((f) => ({ ...f, apiKey: v }))}
                    type="password"
                    placeholder="sk-..."
                  />
                )}
                <InputField
                  label="Base URL (optional)"
                  value={editForm.baseUrl}
                  onChange={(v) => setEditForm((f) => ({ ...f, baseUrl: v }))}
                  placeholder="https://api.openai.com/v1"
                />
                <InputField
                  label="Default Model"
                  value={editForm.defaultModel}
                  onChange={(v) => setEditForm((f) => ({ ...f, defaultModel: v }))}
                  placeholder="gpt-4o"
                />
                <div className="flex gap-2 justify-end">
                  <ActionButton
                    variant="secondary"
                    icon={<X size={14} />}
                    label="Cancel"
                    onClick={() => setEditingProvider(null)}
                  />
                  <ActionButton
                    icon={<Check size={14} />}
                    label="Save"
                    onClick={() => saveProvider(p.provider)}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  variant="secondary"
                  icon={<Key size={14} />}
                  label={p.hasApiKey ? "Change Key" : "Set Key"}
                  onClick={() => startEdit(p)}
                />
                <ActionButton
                  variant="secondary"
                  icon={testingProviders.has(p.provider) ? <Spinner /> : <Zap size={14} />}
                  label="Test"
                  onClick={() => testProvider(p.provider)}
                  disabled={testingProviders.has(p.provider)}
                />
                <ActionButton
                  variant="secondary"
                  icon={fetchingModels === p.provider ? <Spinner /> : <RefreshCw size={14} />}
                  label="Fetch Models"
                  onClick={() => fetchModels(p.provider)}
                  disabled={fetchingModels === p.provider}
                />
                {(() => {
                const models = fetchedModels[p.provider];
                return models && models.length > 0 ? (
                  <div className="w-full mt-2">
                    <p className="text-xs text-muted-foreground mb-1">Available models:</p>
                    <div className="flex flex-wrap gap-1">
                      {models.slice(0, 10).map((m) => (
                        <span key={m} className="inline-block rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {m}
                        </span>
                      ))}
                      {models.length > 10 && (
                        <span className="text-xs text-muted-foreground">+{models.length - 10} more</span>
                      )}
                    </div>
                  </div>
                ) : null;
              })()}
              </div>
            )}
          </Section>
        ))}
      </div>
    );
  }

  // ── Marketplace Tab ───────────────────────────────────

  function MarketplaceTab() {
    const [marketplace, setMarketplace] = useState<{ builtIn: api.MarketplaceProvider[]; community: api.MarketplaceProvider[] } | null>(null);
    const [loadingMp, setLoadingMp] = useState(true);
    const [addingCustom, setAddingCustom] = useState(false);
    const [customForm, setCustomForm] = useState({
      id: "",
      label: "",
      baseUrl: "",
      apiKey: "",
      defaultModel: "",
    });
    const [customProviders, setCustomProviders] = useState<api.ProviderInfo[]>([]);

    useEffect(() => {
      Promise.all([
        api.getMarketplace().then(setMarketplace).catch(() => null),
        api.listProviders().then((p) => setCustomProviders(p.filter((x) => x.isCustom))).catch(() => null),
      ]).finally(() => setLoadingMp(false));
    }, []);

    const addFromMarketplace = async (mp: api.MarketplaceProvider) => {
      try {
        await api.upsertCustomProvider(mp.id, {
          label: mp.label,
          baseUrl: mp.baseUrl,
          enabled: true,
        });
        showSuccess(`"${mp.label}" added! Configure API key in Providers tab.`);
        const providers = await api.listProviders();
        setCustomProviders(providers.filter((x) => x.isCustom));
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to add provider");
      }
    };

    const addCustom = async () => {
      if (!customForm.id || !customForm.baseUrl) {
        showError("Provider ID and Base URL are required");
        return;
      }
      try {
        await api.upsertCustomProvider(customForm.id, customForm);
        showSuccess(`Custom provider "${customForm.label || customForm.id}" added`);
        setAddingCustom(false);
        setCustomForm({ id: "", label: "", baseUrl: "", apiKey: "", defaultModel: "" });
        const providers = await api.listProviders();
        setCustomProviders(providers.filter((x) => x.isCustom));
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to add custom provider");
      }
    };

    const removeCustom = async (id: string) => {
      try {
        await api.deleteCustomProvider(id);
        showSuccess(`Custom provider "${id}" removed`);
        setCustomProviders((prev) => prev.filter((p) => p.provider !== id));
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to remove");
      }
    };

    if (loadingMp) {
      return <div className="flex items-center justify-center py-12"><Spinner /></div>;
    }

    return (
      <div className="space-y-4">
        {/* Custom providers already added */}
        {customProviders.length > 0 && (
          <Section title="Your Custom Providers">
            <div className="space-y-2">
              {customProviders.map((p) => (
                <div key={p.provider} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                  <div>
                    <span className="text-sm font-medium">{p.label || p.provider}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{p.defaultModel}</span>
                    {p.hasApiKey && <span className="ml-2 text-xs text-green-500">Key set</span>}
                  </div>
                  <ActionButton
                    variant="danger"
                    icon={<Trash2 size={14} />}
                    label="Remove"
                    onClick={() => removeCustom(p.provider)}
                  />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Add custom provider form */}
        {addingCustom ? (
          <Section title="Add Custom Provider">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Provider ID" value={customForm.id} onChange={(v) => setCustomForm((f) => ({ ...f, id: v }))} placeholder="my-provider" />
                <InputField label="Display Label" value={customForm.label} onChange={(v) => setCustomForm((f) => ({ ...f, label: v }))} placeholder="My Provider" />
              </div>
              <InputField label="Base URL" value={customForm.baseUrl} onChange={(v) => setCustomForm((f) => ({ ...f, baseUrl: v }))} placeholder="https://api.my-provider.com/v1" />
              <div className="grid grid-cols-2 gap-3">
                <InputField label="API Key" value={customForm.apiKey} onChange={(v) => setCustomForm((f) => ({ ...f, apiKey: v }))} type="password" placeholder="sk-..." />
                <InputField label="Default Model" value={customForm.defaultModel} onChange={(v) => setCustomForm((f) => ({ ...f, defaultModel: v }))} placeholder="model-id" />
              </div>
              <div className="flex gap-2 justify-end">
                <ActionButton variant="secondary" icon={<X size={14} />} label="Cancel" onClick={() => setAddingCustom(false)} />
                <ActionButton icon={<Check size={14} />} label="Add Provider" onClick={addCustom} />
              </div>
            </div>
          </Section>
        ) : (
          <button
            onClick={() => setAddingCustom(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus size={18} />
            Add Custom Provider (OpenAI-compatible)
          </button>
        )}

        {/* Marketplace community providers */}
        <Section title="Community Providers" description="One-click add popular providers. Configure API keys in the Providers tab.">
          <div className="grid gap-2 sm:grid-cols-2">
            {marketplace?.community.map((mp) => (
              <div key={mp.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{mp.label}</span>
                    {mp.docsUrl && (
                      <a href={mp.docsUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{mp.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">{mp.baseUrl}</p>
                </div>
                <ActionButton
                  icon={<Plus size={14} />}
                  label="Add"
                  onClick={() => addFromMarketplace(mp)}
                />
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  // ── Integrations Tab ──────────────────────────────────

  function IntegrationsTab() {
    const [integrations, setIntegrations] = useState<api.IntegrationInfo[]>([]);
    const [loadingInts, setLoadingInts] = useState(true);

    // GitHub form
    const [ghToken, setGhToken] = useState("");
    const [ghOwner, setGhOwner] = useState("");
    const [ghRepo, setGhRepo] = useState("");
    const [ghBranch, setGhBranch] = useState("main");
    const [ghAutoSync, setGhAutoSync] = useState(false);
    const [ghEnabled, setGhEnabled] = useState(false);

    // Skills form
    const [skillsEnabled, setSkillsEnabled] = useState(true);
    const [skillsAutoDiscover, setSkillsAutoDiscover] = useState(true);
    const [skillsCustomDirs, setSkillsCustomDirs] = useState("");

    const loadIntegrations = useCallback(async () => {
      try {
        const data = await api.listIntegrations();
        setIntegrations(data);

        const gh = data.find((i) => i.type === "github");
        if (gh?.config) {
          setGhToken((gh.config as any).token || "");
          setGhOwner((gh.config as any).owner || "");
          setGhRepo((gh.config as any).repo || "");
          setGhBranch((gh.config as any).branch || "main");
          setGhAutoSync((gh.config as any).autoSync || false);
          setGhEnabled(gh.enabled);
        }

        const sk = data.find((i) => i.type === "skills");
        if (sk?.config) {
          setSkillsEnabled(sk.enabled);
          setSkillsAutoDiscover((sk.config as any).autoDiscover ?? true);
          setSkillsCustomDirs(((sk.config as any).customSkillDirs ?? []).join(", "));
        }
      } catch (err) {
        console.error("Failed to load integrations:", err);
      } finally {
        setLoadingInts(false);
      }
    }, []);

    useEffect(() => { loadIntegrations(); }, [loadIntegrations]);

    const saveGitHub = async () => {
      setSaving(true);
      try {
        await api.updateGitHubIntegration({
          token: ghToken || undefined,
          owner: ghOwner || undefined,
          repo: ghRepo || undefined,
          branch: ghBranch,
          autoSync: ghAutoSync,
          enabled: ghEnabled,
        });
        showSuccess("GitHub integration saved");
        loadIntegrations();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    };

    const saveSkills = async () => {
      setSaving(true);
      try {
        await api.updateSkillsIntegration({
          autoDiscover: skillsAutoDiscover,
          customSkillDirs: skillsCustomDirs.split(",").map((s) => s.trim()).filter(Boolean),
          enabled: skillsEnabled,
        });
        showSuccess("Skills integration saved");
        loadIntegrations();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    };

    if (loadingInts) {
      return <div className="flex items-center justify-center py-12"><Spinner /></div>;
    }

    return (
      <div className="space-y-4">
        {/* GitHub Integration */}
        <Section
          title={
            <div className="flex items-center justify-between w-full">
              <span className="flex items-center gap-2"><Github size={16} /> GitHub</span>
              <Toggle enabled={ghEnabled} onChange={setGhEnabled} />
            </div>
          }
          description="Sync agent workspaces with a GitHub repository"
        >
          <div className="space-y-3">
            <InputField
              label="Personal Access Token"
              value={ghToken}
              onChange={setGhToken}
              type="password"
              placeholder="ghp_..."
            />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Repository Owner" value={ghOwner} onChange={setGhOwner} placeholder="username" />
              <InputField label="Repository Name" value={ghRepo} onChange={setGhRepo} placeholder="my-repo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Branch" value={ghBranch} onChange={setGhBranch} placeholder="main" />
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ghAutoSync}
                    onChange={(e) => setGhAutoSync(e.target.checked)}
                    className="rounded"
                  />
                  Auto-sync on workspace changes
                </label>
              </div>
            </div>
            <div className="flex justify-end">
              <SaveButton onClick={saveGitHub} loading={saving} />
            </div>
          </div>
        </Section>

        {/* Skills Integration */}
        <Section
          title={
            <div className="flex items-center justify-between w-full">
              <span className="flex items-center gap-2"><Zap size={16} /> Skills</span>
              <Toggle enabled={skillsEnabled} onChange={setSkillsEnabled} />
            </div>
          }
          description="Enable Bud skills and custom skill directories"
        >
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={skillsAutoDiscover}
                onChange={(e) => setSkillsAutoDiscover(e.target.checked)}
                className="rounded"
              />
              Auto-discover available skills
            </label>
            <InputField
              label="Custom Skill Directories (comma-separated)"
              value={skillsCustomDirs}
              onChange={setSkillsCustomDirs}
              placeholder="/path/to/skills1, /path/to/skills2"
            />
            <div className="flex justify-end">
              <SaveButton onClick={saveSkills} loading={saving} />
            </div>
          </div>
        </Section>

        {/* Active Integrations List */}
        <Section title="Active Integrations">
          {integrations.length === 0 ? (
            <p className="text-xs text-muted-foreground">No integrations configured yet.</p>
          ) : (
            <div className="space-y-1">
              {integrations.map((i) => (
                <div key={i.type} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{i.label}</span>
                    <StatusBadge ok={i.enabled} label={i.enabled ? "Enabled" : "Disabled"} />
                    {i.configured && <span className="text-xs text-green-500">Configured</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    );
  }

  // ── Telegram Tab ──────────────────────────────────────

  function TelegramTab() {
    const [bots, setBots] = useState<api.TelegramBotInfo[]>([]);
    const [webhookBaseUrl, setWebhookBaseUrl] = useState("");
    const [loadingTelegram, setLoadingTelegram] = useState(true);
    const [editingBotId, setEditingBotId] = useState<string | null>(null);
    const [newBotForm, setNewBotForm] = useState({
      botId: "",
      botToken: "",
      leadAgentId: "lead",
      defaultAgentId: "",
      label: "",
      allowedChatIds: "",
    });
    const [editForm, setEditForm] = useState({
      botToken: "",
      leadAgentId: "lead",
      defaultAgentId: "",
      label: "",
      allowedChatIds: "",
      enabled: true,
    });
    const [mappingEditor, setMappingEditor] = useState<{ botId: string; key: string; value: string } | null>(null);
    const [settingWebhook, setSettingWebhook] = useState<string | null>(null);

    const loadTelegram = useCallback(async () => {
      try {
        const data = await api.getTelegramSettings();
        setBots(data.bots || []);
        setWebhookBaseUrl(data.webhookBaseUrl || "");
      } catch (err) {
        console.error("Failed to load Telegram settings:", err);
      } finally {
        setLoadingTelegram(false);
      }
    }, []);

    useEffect(() => { loadTelegram(); }, [loadTelegram]);

    const addBot = async () => {
      if (!newBotForm.botToken) {
        showError("Bot token is required");
        return;
      }
      try {
        const allowedIds = newBotForm.allowedChatIds
          .split(",")
          .map((s) => parseInt(s.trim()))
          .filter((n) => !isNaN(n));

        await api.upsertTelegramBot(newBotForm.botId || `bot-${Date.now()}`, {
          botToken: newBotForm.botToken,
          leadAgentId: newBotForm.leadAgentId || "lead",
          defaultAgentId: newBotForm.defaultAgentId || undefined,
          label: newBotForm.label || undefined,
          allowedChatIds: allowedIds.length > 0 ? allowedIds : undefined,
          enabled: true,
          agentMappings: {},
        });
        showSuccess("Telegram bot added");
        setNewBotForm({ botId: "", botToken: "", leadAgentId: "lead", defaultAgentId: "", label: "", allowedChatIds: "" });
        loadTelegram();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to add bot");
      }
    };

    const updateBot = async (botId: string) => {
      try {
        const allowedIds = editForm.allowedChatIds
          .split(",")
          .map((s) => parseInt(s.trim()))
          .filter((n) => !isNaN(n));

        await api.upsertTelegramBot(botId, {
          botToken: editForm.botToken || undefined,
          leadAgentId: editForm.leadAgentId,
          defaultAgentId: editForm.defaultAgentId || undefined,
          label: editForm.label || undefined,
          enabled: editForm.enabled,
          allowedChatIds: allowedIds.length > 0 ? allowedIds : undefined,
        });
        showSuccess(`Bot "${botId}" updated`);
        setEditingBotId(null);
        loadTelegram();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to update bot");
      }
    };

    const removeBot = async (botId: string) => {
      try {
        await api.deleteTelegramBot(botId);
        showSuccess(`Bot "${botId}" removed`);
        loadTelegram();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to remove bot");
      }
    };

    const startEdit = (bot: api.TelegramBotInfo) => {
      setEditingBotId(bot.botId);
      setEditForm({
        botToken: "",
        leadAgentId: bot.leadAgentId || "lead",
        defaultAgentId: bot.defaultAgentId || "",
        label: bot.label || "",
        allowedChatIds: (bot.allowedChatIds || []).join(", "),
        enabled: bot.enabled,
      });
    };

    const setBotWebhook = async (botId: string) => {
      setSettingWebhook(botId);
      try {
        const result = await api.setTelegramWebhook(botId);
        showSuccess(result?.description ? `Webhook: ${result.description}` : "Webhook set!");
        loadTelegram();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to set webhook");
      } finally {
        setSettingWebhook(null);
      }
    };

    const addMapping = async (botId: string) => {
      if (!mappingEditor || !mappingEditor.key) return;
      try {
        const bot = bots.find((b) => b.botId === botId);
        const mappings = { ...(bot?.agentMappings || {}), [mappingEditor.key]: mappingEditor.value || bot?.leadAgentId || "lead" };

        // Save via full telegram settings update
        const updatedBots = bots.map((b) =>
          b.botId === botId ? { ...b, agentMappings: mappings } : b
        );
        await api.updateTelegramSettings({ bots: updatedBots as any, webhookBaseUrl });
        showSuccess("Chat-to-agent mapping added");
        setMappingEditor(null);
        loadTelegram();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to add mapping");
      }
    };

    const removeMapping = async (botId: string, chatId: string) => {
      try {
        const bot = bots.find((b) => b.botId === botId);
        const mappings = { ...(bot?.agentMappings || {}) };
        delete mappings[chatId];

        const updatedBots = bots.map((b) =>
          b.botId === botId ? { ...b, agentMappings: mappings } : b
        );
        await api.updateTelegramSettings({ bots: updatedBots as any, webhookBaseUrl });
        showSuccess("Mapping removed");
        loadTelegram();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to remove mapping");
      }
    };

    const saveWebhookBaseUrl = async () => {
      try {
        await api.updateTelegramSettings({ webhookBaseUrl });
        showSuccess("Webhook base URL saved");
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to save");
      }
    };

    if (loadingTelegram) {
      return <div className="flex items-center justify-center py-12"><Spinner /></div>;
    }

    return (
      <div className="space-y-4">
        {/* Webhook base URL */}
        <Section title="Webhook Configuration" description="Base URL for Telegram to call back to (e.g., https://your-worker.workers.dev)">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <InputField
                label="Webhook Base URL"
                value={webhookBaseUrl}
                onChange={setWebhookBaseUrl}
                placeholder="https://your-worker.workers.dev"
              />
            </div>
            <SaveButton onClick={saveWebhookBaseUrl} />
          </div>
        </Section>

        {/* Bots list */}
        <Section title="Telegram Bots" description="Each bot has its own lead agent and per-chat agent mappings">
          {bots.length === 0 && (
            <div className="text-center py-6">
              <Bot size={32} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No Telegram bots configured yet.</p>
              <p className="text-xs text-muted-foreground">Add a bot below to get started.</p>
            </div>
          )}

          <div className="space-y-3">
            {bots.map((bot) => (
              <div key={bot.botId} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot size={16} className="text-blue-400" />
                    <span className="text-sm font-medium">{bot.label || bot.botId}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{bot.botId}</span>
                    <StatusBadge ok={bot.enabled} label={bot.enabled ? "Active" : "Disabled"} />
                    {bot.hasBotToken && <StatusBadge ok label="Token set" />}
                    {bot.webhookUrl && <StatusBadge ok label="Webhook set" />}
                  </div>
                  <div className="flex gap-1">
                    <ActionButton
                      variant="secondary"
                      icon={settingWebhook === bot.botId ? <Spinner /> : <Webhook size={14} />}
                      label="Set Webhook"
                      onClick={() => setBotWebhook(bot.botId)}
                      disabled={settingWebhook === bot.botId}
                    />
                    <ActionButton
                      variant="secondary"
                      icon={<MessageSquare size={14} />}
                      label="Edit"
                      onClick={() => startEdit(bot)}
                    />
                    <ActionButton
                      variant="danger"
                      icon={<Trash2 size={14} />}
                      label="Remove"
                      onClick={() => removeBot(bot.botId)}
                    />
                  </div>
                </div>

                {bot.leadAgentId && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Lead Agent:</span> <code className="bg-muted px-1 rounded">{bot.leadAgentId}</code>
                    {bot.defaultAgentId && (
                      <> | <span className="font-medium">Default:</span> <code className="bg-muted px-1 rounded">{bot.defaultAgentId}</code></>
                    )}
                    {bot.allowedChatIds && bot.allowedChatIds.length > 0 && (
                      <> | <span className="font-medium">Allowed chats:</span> {bot.allowedChatIds.join(", ")}</>
                    )}
                  </div>
                )}

                {/* Agent mappings */}
                {Object.keys(bot.agentMappings || {}).length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Chat → Agent Mappings
                    </p>
                    <div className="space-y-1">
                      {Object.entries(bot.agentMappings).map(([chatId, agentId]) => (
                        <div key={chatId} className="flex items-center justify-between bg-muted/30 rounded px-2 py-1">
                          <span className="text-xs">
                            Chat <code className="bg-muted px-1 rounded">{chatId}</code> → Agent <code className="bg-muted px-1 rounded">{agentId}</code>
                          </span>
                          <button
                            onClick={() => removeMapping(bot.botId, chatId)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add mapping */}
                {mappingEditor?.botId === bot.botId ? (
                  <div className="flex gap-2 items-center mt-2">
                    <InputField
                      value={mappingEditor.key}
                      onChange={(v) => setMappingEditor((m) => m ? { ...m, key: v } : null)}
                      placeholder="Chat ID"
                      className="flex-1"
                    />
                    <InputField
                      value={mappingEditor.value}
                      onChange={(v) => setMappingEditor((m) => m ? { ...m, value: v } : null)}
                      placeholder="Agent ID"
                      className="flex-1"
                    />
                    <ActionButton icon={<Check size={14} />} label="Add" onClick={() => addMapping(bot.botId)} />
                    <ActionButton variant="secondary" icon={<X size={14} />} label="" onClick={() => setMappingEditor(null)} />
                  </div>
                ) : (
                  <ActionButton
                    variant="secondary"
                    icon={<Plus size={14} />}
                    label="Add Chat Mapping"
                    onClick={() => setMappingEditor({ botId: bot.botId, key: "", value: "" })}
                  />
                )}

                {/* Edit form */}
                {editingBotId === bot.botId && (
                  <div className="mt-3 border-t border-border pt-3 space-y-3">
                    <InputField
                      label="Bot Token (leave blank to keep existing)"
                      value={editForm.botToken}
                      onChange={(v) => setEditForm((f) => ({ ...f, botToken: v }))}
                      type="password"
                      placeholder="Leave blank to keep current"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <InputField
                        label="Lead Agent ID"
                        value={editForm.leadAgentId}
                        onChange={(v) => setEditForm((f) => ({ ...f, leadAgentId: v }))}
                        placeholder="lead"
                      />
                      <InputField
                        label="Default Agent ID"
                        value={editForm.defaultAgentId}
                        onChange={(v) => setEditForm((f) => ({ ...f, defaultAgentId: v }))}
                        placeholder="Same as lead agent"
                      />
                    </div>
                    <InputField
                      label="Display Label"
                      value={editForm.label}
                      onChange={(v) => setEditForm((f) => ({ ...f, label: v }))}
                      placeholder="My Bot"
                    />
                    <InputField
                      label="Allowed Chat IDs (comma-separated, empty = all)"
                      value={editForm.allowedChatIds}
                      onChange={(v) => setEditForm((f) => ({ ...f, allowedChatIds: v }))}
                      placeholder="12345, 67890"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Enabled</label>
                      <Toggle
                        enabled={editForm.enabled}
                        onChange={(v) => setEditForm((f) => ({ ...f, enabled: v }))}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <ActionButton variant="secondary" icon={<X size={14} />} label="Cancel" onClick={() => setEditingBotId(null)} />
                      <ActionButton icon={<Check size={14} />} label="Save" onClick={() => updateBot(bot.botId)} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Add new bot */}
        <Section title="Add New Bot">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <InputField
                label="Bot ID"
                value={newBotForm.botId}
                onChange={(v) => setNewBotForm((f) => ({ ...f, botId: v }))}
                placeholder="my-bot"
              />
              <InputField
                label="Display Label"
                value={newBotForm.label}
                onChange={(v) => setNewBotForm((f) => ({ ...f, label: v }))}
                placeholder="My Telegram Bot"
              />
            </div>
            <InputField
              label="Bot Token (from BotFather)"
              value={newBotForm.botToken}
              onChange={(v) => setNewBotForm((f) => ({ ...f, botToken: v }))}
              type="password"
              placeholder="123456:ABC-DEF1234"
            />
            <div className="grid grid-cols-2 gap-3">
              <InputField
                label="Lead Agent ID"
                value={newBotForm.leadAgentId}
                onChange={(v) => setNewBotForm((f) => ({ ...f, leadAgentId: v }))}
                placeholder="lead"
              />
              <InputField
                label="Default Agent ID (optional)"
                value={newBotForm.defaultAgentId}
                onChange={(v) => setNewBotForm((f) => ({ ...f, defaultAgentId: v }))}
                placeholder="Same as lead agent"
              />
            </div>
            <InputField
              label="Allowed Chat IDs (comma-separated, empty = all)"
              value={newBotForm.allowedChatIds}
              onChange={(v) => setNewBotForm((f) => ({ ...f, allowedChatIds: v }))}
              placeholder="12345, 67890"
            />
            <div className="flex justify-end">
              <ActionButton icon={<Plus size={14} />} label="Add Bot" onClick={addBot} />
            </div>
          </div>
        </Section>

        {/* Lead Agent Info */}
        <Section title="About Lead Agents" description="Lead Agent architecture explained">
          <div className="text-xs text-muted-foreground space-y-2">
            <p><strong>Lead Agent</strong> — The omnipotent orchestrator. Has full read/write access to all agent workspaces and can spawn/modify sub-agents via system tools.</p>
            <p><strong>Sub-Agents</strong> — Specialized agents that handle specific tasks within their sandboxed workspace.</p>
            <p><strong>Chat-to-Agent Mappings</strong> — Route specific Telegram chats to specific agents. Unmapped chats use the default agent (or lead agent).</p>
            <p><strong>Multiple Bots</strong> — Each bot operates independently with its own lead agent, agents, and chat mappings. No conflicts between bots.</p>
          </div>
        </Section>
      </div>
    );
  }

  // ── Load initial settings ─────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getSettings();
        setDefaultProvider(data.defaultProvider || "workers-ai");
        setDefaultModel(data.defaultModel || "@cf/meta/llama-3.2-3b-instruct");
        setDefaultTemperature(data.defaultTemperature ?? 0.7);
        setDefaultMaxTokens(data.defaultMaxTokens ?? 4096);
        setAppName(data.appName || "Multi-Agent Hub");
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading settings...</span>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure providers, integrations, Telegram bots, and global defaults.
        </p>
      </div>

      {/* Toast notifications */}
      {successMsg && (
        <div className="rounded-md bg-green-500/10 border border-green-500/20 px-4 py-2 text-sm text-green-500 flex items-center gap-2">
          <Check size={16} />
          {successMsg}
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm text-red-500 flex items-center gap-2">
          <X size={16} />
          {error}
        </div>
      )}

      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        <Tabs.List className="flex border-b border-border mb-6 overflow-x-auto">
          {TABS.map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 border-transparent",
                "data-[state=active]:border-primary data-[state=active]:text-foreground",
                "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="general"><GeneralTab /></Tabs.Content>
        <Tabs.Content value="providers"><ProvidersTab /></Tabs.Content>
        <Tabs.Content value="marketplace"><MarketplaceTab /></Tabs.Content>
        <Tabs.Content value="integrations"><IntegrationsTab /></Tabs.Content>
        <Tabs.Content value="telegram"><TelegramTab /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
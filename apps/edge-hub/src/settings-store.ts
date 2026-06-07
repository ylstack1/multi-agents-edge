import type { AppSettings, ProviderSetting, IntegrationSetting, TelegramBotConfig } from '@midas/contracts';
import { AppSettingsSchema, BUILT_IN_PROVIDERS } from '@midas/contracts';

const SETTINGS_KEY = 'app:settings';

/**
 * KV-based settings store for the Multi-Agent Hub.
 * Stores provider configs, integration configs, Telegram settings, custom providers.
 */
export class SettingsStore {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /** Load full app settings */
  async load(): Promise<AppSettings> {
    try {
      const raw = await this.kv.get(SETTINGS_KEY, 'text');
      if (!raw) return this.defaults();
      const parsed = JSON.parse(raw);
      return AppSettingsSchema.parse(parsed);
    } catch {
      return this.defaults();
    }
  }

  /** Save full app settings */
  async save(settings: AppSettings): Promise<void> {
    const validated = AppSettingsSchema.parse(settings);
    await this.kv.put(SETTINGS_KEY, JSON.stringify(validated));
  }

  // ── Provider Methods ──────────────────────────────────────────

  /** Get a specific provider setting (built-in or custom) */
  async getProvider(provider: string): Promise<ProviderSetting | null> {
    const settings = await this.load();
    return settings.providers[provider] ?? settings.customProviders[provider] ?? null;
  }

  /** Upsert a built-in provider setting */
  async upsertProvider(provider: string, setting: ProviderSetting): Promise<void> {
    const settings = await this.load();
    settings.providers[provider] = setting;
    await this.save(settings);
  }

  /** Delete a provider setting (reset built-in to defaults) */
  async deleteProvider(provider: string): Promise<void> {
    const settings = await this.load();
    delete settings.providers[provider];
    await this.save(settings);
  }

  /** Add or update a custom (user-registered) provider */
  async upsertCustomProvider(provider: string, setting: ProviderSetting): Promise<void> {
    const settings = await this.load();
    settings.customProviders[provider] = { ...setting, isCustom: true };
    await this.save(settings);
  }

  /** Remove a custom provider */
  async deleteCustomProvider(provider: string): Promise<void> {
    const settings = await this.load();
    delete settings.customProviders[provider];
    await this.save(settings);
  }

  /** Get all enabled providers (built-in + custom) */
  async getEnabledProviders(): Promise<Array<{ provider: string; setting: ProviderSetting }>> {
    const settings = await this.load();
    const all = { ...settings.providers, ...settings.customProviders };
    return Object.entries(all)
      .filter(([, s]) => s.enabled)
      .map(([provider, setting]) => ({ provider, setting }));
  }

  /** Get all providers with metadata (built-in + custom combined) */
  async getAllProviders(): Promise<Array<{
    provider: string;
    enabled: boolean;
    defaultModel: string;
    models: string[];
    hasApiKey: boolean;
    isCustom: boolean;
    label: string;
  }>> {
    const settings = await this.load();
    const result: Array<{
      provider: string;
      enabled: boolean;
      defaultModel: string;
      models: string[];
      hasApiKey: boolean;
      isCustom: boolean;
      label: string;
    }> = [];

    // Built-in providers
    for (const builtIn of BUILT_IN_PROVIDERS) {
      const saved = settings.providers[builtIn.id];
      result.push({
        provider: builtIn.id,
        enabled: saved?.enabled ?? builtIn.id === 'workers-ai',
        defaultModel: saved?.defaultModel ?? '',
        models: saved?.models ?? [],
        hasApiKey: !!(saved?.apiKey) || builtIn.id === 'workers-ai',
        isCustom: false,
        label: builtIn.label,
      });
    }

    // Custom providers
    for (const [id, saved] of Object.entries(settings.customProviders)) {
      result.push({
        provider: id,
        enabled: saved.enabled,
        defaultModel: saved.defaultModel ?? '',
        models: saved.models ?? [],
        hasApiKey: !!(saved.apiKey),
        isCustom: true,
        label: saved.label ?? id,
      });
    }

    return result;
  }

  /** Get the default provider for chat */
  async getDefaultProvider(): Promise<{ provider: string; model: string }> {
    const settings = await this.load();
    const provider = settings.defaultProvider;
    const model = settings.defaultModel || this.defaultModelFor(provider);
    return { provider, model };
  }

  private defaultModelFor(provider: string): string {
    const defaults: Record<string, string> = {
      'workers-ai': '@cf/meta/llama-3.2-3b-instruct',
      openai: 'gpt-4o',
      anthropic: 'claude-sonnet-4-20250514',
      google: 'gemini-2.0-flash',
      deepseek: 'deepseek-chat',
      grok: 'grok-2',
      openrouter: 'openai/gpt-4o',
    };
    return defaults[provider] ?? '@cf/meta/llama-3.2-3b-instruct';
  }

  // ── Integration Methods ───────────────────────────────────────

  /** Get an integration setting */
  async getIntegration(type: string): Promise<IntegrationSetting | null> {
    const settings = await this.load();
    return settings.integrations[type] ?? null;
  }

  /** Upsert an integration setting */
  async upsertIntegration(type: string, setting: IntegrationSetting): Promise<void> {
    const settings = await this.load();
    settings.integrations[type] = setting;
    await this.save(settings);
  }

  /** Delete an integration */
  async deleteIntegration(type: string): Promise<void> {
    const settings = await this.load();
    delete settings.integrations[type];
    await this.save(settings);
  }

  // ── Telegram Methods ──────────────────────────────────────────

  /** Get Telegram settings (multi-bot) */
  async getTelegramSettings() {
    const settings = await this.load();
    return settings.telegram;
  }

  /** Get a specific bot config by botId */
  async getTelegramBot(botId: string): Promise<TelegramBotConfig | null> {
    const settings = await this.load();
    return settings.telegram.bots.find(b => b.botId === botId) ?? null;
  }

  /** Add or update a Telegram bot config */
  async upsertTelegramBot(config: TelegramBotConfig): Promise<void> {
    const settings = await this.load();
    const idx = settings.telegram.bots.findIndex(b => b.botId === config.botId);
    if (idx >= 0) {
      settings.telegram.bots[idx] = config;
    } else {
      settings.telegram.bots.push(config);
    }
    await this.save(settings);
  }

  /** Delete a Telegram bot config */
  async deleteTelegramBot(botId: string): Promise<void> {
    const settings = await this.load();
    settings.telegram.bots = settings.telegram.bots.filter(b => b.botId !== botId);
    await this.save(settings);
  }

  /** Resolve which agent handles a given chat on a given bot */
  async resolveTelegramAgent(
    botId: string,
    chatId: number | string,
  ): Promise<{ agentId: string; botConfig: TelegramBotConfig | null }> {
    const bot = await this.getTelegramBot(botId);
    if (!bot) return { agentId: 'lead', botConfig: null };

    const chatKey = String(chatId);
    const mappedAgent = bot.agentMappings[chatKey];
    if (mappedAgent) return { agentId: mappedAgent, botConfig: bot };

    return { agentId: bot.defaultAgentId ?? bot.leadAgentId, botConfig: bot };
  }

  // ── Defaults ──────────────────────────────────────────────────

  private defaults(): AppSettings {
    const providers: Record<string, ProviderSetting> = {};
    for (const p of BUILT_IN_PROVIDERS) {
      providers[p.id] = {
        provider: p.id,
        enabled: p.id === 'workers-ai',
        defaultModel: this.defaultModelFor(p.id),
        label: p.label,
      };
    }
    return {
      providers,
      customProviders: {},
      integrations: {},
      defaultProvider: 'workers-ai',
      defaultModel: this.defaultModelFor('workers-ai'),
      defaultTemperature: 0.7,
      defaultMaxTokens: 4096,
      telegram: { bots: [], leadAgentId: 'lead', agentMappings: {} },
      appName: 'Multi-Agent Hub',
    };
  }
}

export { AppSettingsSchema, type AppSettings, type ProviderSetting, type IntegrationSetting };
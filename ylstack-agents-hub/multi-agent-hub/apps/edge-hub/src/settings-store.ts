import type { AppSettings, ProviderSetting, IntegrationSetting } from '@midas/contracts';
import { AppSettingsSchema, LLM_PROVIDERS } from '@midas/contracts';

const SETTINGS_KEY = 'app:settings';

/**
 * KV-based settings store for the Multi-Agent Hub.
 * Stores provider configs, integration configs, and Telegram settings.
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

  /** Get a specific provider setting */
  async getProvider(provider: string): Promise<ProviderSetting | null> {
    const settings = await this.load();
    return settings.providers[provider] ?? null;
  }

  /** Upsert a provider setting */
  async upsertProvider(provider: string, setting: ProviderSetting): Promise<void> {
    const settings = await this.load();
    settings.providers[provider] = setting;
    await this.save(settings);
  }

  /** Delete a provider setting */
  async deleteProvider(provider: string): Promise<void> {
    const settings = await this.load();
    delete settings.providers[provider];
    await this.save(settings);
  }

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

  /** Get all enabled providers */
  async getEnabledProviders(): Promise<Array<{ provider: string; setting: ProviderSetting }>> {
    const settings = await this.load();
    return Object.entries(settings.providers)
      .filter(([, s]) => s.enabled)
      .map(([provider, setting]) => ({ provider, setting }));
  }

  /** Get the default provider for chat */
  async getDefaultProvider(): Promise<{ provider: string; model: string }> {
    const settings = await this.load();
    const provider = settings.defaultProvider;
    const model = settings.defaultModel || this.defaultModelFor(provider);
    return { provider, model };
  }

  /** Get Telegram config */
  async getTelegramConfig(): Promise<{ botToken?: string; leadAgentId: string; agentMappings: Record<string, string> }> {
    const settings = await this.load();
    return settings.telegram;
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

  private defaults(): AppSettings {
    const providers: Record<string, ProviderSetting> = {};
    for (const p of LLM_PROVIDERS) {
      providers[p] = {
        provider: p,
        enabled: p === 'workers-ai',
        defaultModel: this.defaultModelFor(p),
      };
    }
    return {
      providers,
      integrations: {},
      defaultProvider: 'workers-ai',
      defaultModel: this.defaultModelFor('workers-ai'),
      telegram: { leadAgentId: 'lead', agentMappings: {} },
    };
  }
}

export { AppSettingsSchema, type AppSettings, type ProviderSetting, type IntegrationSetting };
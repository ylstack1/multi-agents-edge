import { Hono } from 'hono';
import { SettingsStore } from '../settings-store.js';
import { createProviderFromSettings, fetchProviderModels, getRegisteredProviders, DEFAULT_MODELS } from '@midas/ai-provider';
import {
  BUILT_IN_PROVIDERS,
  type ProviderSetting,
  type CustomProviderRegistration,
  type TelegramBotConfig,
} from '@midas/contracts';
import type { Env } from '../../worker-configuration.d.ts';

const settingsRoutes = new Hono<{ Bindings: Env }>();

// ── Helper: strip secrets from provider settings ────────────

function stripProviderSecrets(setting: ProviderSetting): any {
  const safe = { ...setting };
  delete safe.apiKey;
  return safe;
}

// ── Full settings ────────────────────────────────────────

/** GET /api/settings — Load all settings (API keys stripped) */
settingsRoutes.get('/', async (c) => {
  const store = new SettingsStore(c.env.VFS_CACHE);
  const settings = await store.load();
  const safe = JSON.parse(JSON.stringify(settings));

  // Strip API keys from all providers
  for (const key of Object.keys(safe.providers ?? {})) {
    delete safe.providers[key].apiKey;
  }
  for (const key of Object.keys(safe.customProviders ?? {})) {
    delete safe.customProviders[key].apiKey;
  }
  // Strip bot tokens
  if (safe.telegram?.bots) {
    for (const bot of safe.telegram.bots) {
      delete bot.botToken;
    }
  }
  delete safe.telegram?.botToken;

  // Add metadata about which providers have keys configured
  safe.providersWithKeys = Object.entries(settings.providers)
    .filter(([, p]) => !!p.apiKey)
    .map(([k]) => k);
  safe.customProvidersWithKeys = Object.entries(settings.customProviders)
    .filter(([, p]) => !!p.apiKey)
    .map(([k]) => k);
  safe.telegramBotsWithTokens = settings.telegram.bots
    .filter(b => !!b.botToken)
    .map(b => b.botId);

  return c.json({ success: true, data: safe });
});

/** PUT /api/settings — Save all settings (merge API keys from existing) */
settingsRoutes.put('/', async (c) => {
  const store = new SettingsStore(c.env.VFS_CACHE);
  const existing = await store.load();
  const body = await c.req.json();

  // Merge API keys from existing settings if not provided
  for (const key of Object.keys(body.providers ?? {})) {
    if (!body.providers[key].apiKey && existing.providers[key]?.apiKey) {
      body.providers[key].apiKey = existing.providers[key].apiKey;
    }
  }
  for (const key of Object.keys(body.customProviders ?? {})) {
    if (!body.customProviders[key].apiKey && existing.customProviders[key]?.apiKey) {
      body.customProviders[key].apiKey = existing.customProviders[key].apiKey;
    }
  }
  // Merge Telegram bot tokens
  if (body.telegram?.bots) {
    for (const bot of body.telegram.bots) {
      const existingBot = existing.telegram.bots.find(b => b.botId === bot.botId);
      if (!bot.botToken && existingBot?.botToken) {
        bot.botToken = existingBot.botToken;
      }
    }
  }

  const merged = {
    ...existing,
    ...body,
    providers: { ...existing.providers, ...body.providers },
    customProviders: { ...existing.customProviders, ...body.customProviders },
  };
  await store.save(merged as any);
  return c.json({ success: true, data: { message: 'Settings saved' } });
});

// ── Provider management ─────────────────────────────────

/** GET /api/settings/providers — List all providers with status */
settingsRoutes.get('/providers', async (c) => {
  const store = new SettingsStore(c.env.VFS_CACHE);
  const providers = await store.getAllProviders();
  return c.json({ success: true, data: providers });
});

/** GET /api/settings/providers/registered — List registered provider types with defaults */
settingsRoutes.get('/providers/registered', async (c) => {
  const registered = new Set(getRegisteredProviders());
  const providers = BUILT_IN_PROVIDERS.map((p) => ({
    ...p,
    models: DEFAULT_MODELS[p.id] ?? [],
    isRegistered: registered.has(p.id),
  }));
  return c.json({ success: true, data: providers });
});

/** PUT /api/settings/providers/:provider — Upsert a provider */
settingsRoutes.put('/providers/:provider', async (c) => {
  const provider = c.req.param('provider');
  const store = new SettingsStore(c.env.VFS_CACHE);
  const body = await c.req.json<{
    enabled?: boolean;
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    models?: string[];
    customModels?: string[];
    label?: string;
  }>();

  const existing = await store.getProvider(provider);

  await store.upsertProvider(provider, {
    provider: provider as any,
    enabled: body.enabled ?? existing?.enabled ?? true,
    apiKey: body.apiKey || existing?.apiKey,
    baseUrl: body.baseUrl || existing?.baseUrl,
    defaultModel: body.defaultModel || existing?.defaultModel || '',
    models: body.models || existing?.models,
    customModels: body.customModels || existing?.customModels,
    label: body.label || existing?.label,
  });

  return c.json({ success: true, data: { message: `Provider "${provider}" updated` } });
});

/** DELETE /api/settings/providers/:provider — Reset a provider to defaults */
settingsRoutes.delete('/providers/:provider', async (c) => {
  const provider = c.req.param('provider');
  const store = new SettingsStore(c.env.VFS_CACHE);
  await store.deleteProvider(provider);
  return c.json({ success: true, data: { message: `Provider "${provider}" reset` } });
});

/** POST /api/settings/providers/:provider/test — Test a provider connection */
settingsRoutes.post('/providers/:provider/test', async (c) => {
  const provider = c.req.param('provider');
  const store = new SettingsStore(c.env.VFS_CACHE);
  const setting = await store.getProvider(provider);

  if (!setting) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Provider not found' } }, 404);
  }

  const hasApiKey = !!setting.apiKey;

  try {
    const ai = provider === 'workers-ai' ? c.env.AI : undefined;
    const instance = createProviderFromSettings(setting, ai);
    const start = Date.now();
    await instance.complete({
      systemPrompt: 'Reply with only the word "ok"',
      messages: [],
      config: { model: setting.defaultModel || undefined, provider: provider as any, stream: false } as any,
    });
    const latency = Date.now() - start;
    return c.json({ success: true, data: { ok: true, latencyMs: latency } });
  } catch (err) {
    return c.json({
      success: false,
      error: {
        code: 'TEST_FAILED',
        message: err instanceof Error ? err.message : 'Test failed',
        hasKey: hasApiKey,
      },
    }, 400);
  }
});

/** POST /api/settings/providers/:provider/models — Fetch available models from provider API */
settingsRoutes.post('/providers/:provider/models', async (c) => {
  const provider = c.req.param('provider');
  const store = new SettingsStore(c.env.VFS_CACHE);
  const setting = await store.getProvider(provider);

  if (!setting?.apiKey) {
    return c.json({ success: true, data: { models: DEFAULT_MODELS[provider] ?? [] } });
  }

  const models = await fetchProviderModels(provider, setting.apiKey, setting.baseUrl);
  const allModels = [...new Set([...(DEFAULT_MODELS[provider] ?? []), ...models])];
  return c.json({ success: true, data: { models: allModels, fetched: models } });
});

// ── Custom Provider Management (Marketplace) ─────────────────

/** GET /api/settings/custom-providers — List all custom providers */
settingsRoutes.get('/custom-providers', async (c) => {
  const store = new SettingsStore(c.env.VFS_CACHE);
  const settings = await store.load();
  const providers = Object.entries(settings.customProviders).map(([id, s]) => ({
    ...stripProviderSecrets(s),
    provider: id,
    hasApiKey: !!s.apiKey,
  }));
  return c.json({ success: true, data: providers });
});

/** PUT /api/settings/custom-providers/:id — Add or update a custom provider */
settingsRoutes.put('/custom-providers/:id', async (c) => {
  const id = c.req.param('id');
  const store = new SettingsStore(c.env.VFS_CACHE);
  const body = await c.req.json<CustomProviderRegistration>();

  const existing = await store.getProvider(id);

  await store.upsertCustomProvider(id, {
    provider: id,
    enabled: body.enabled ?? true,
    apiKey: body.apiKey || existing?.apiKey,
    baseUrl: body.baseUrl || existing?.baseUrl || '',
    defaultModel: body.defaultModel || existing?.defaultModel || '',
    models: body.models || existing?.models,
    label: body.label || id,
    isCustom: true,
    config: {
      category: body.category || 'openai-compatible',
      description: body.description || '',
      iconUrl: body.iconUrl || '',
    },
  });

  return c.json({ success: true, data: { message: `Custom provider "${id}" saved` } });
});

/** DELETE /api/settings/custom-providers/:id — Remove a custom provider */
settingsRoutes.delete('/custom-providers/:id', async (c) => {
  const id = c.req.param('id');
  const store = new SettingsStore(c.env.VFS_CACHE);
  await store.deleteCustomProvider(id);
  return c.json({ success: true, data: { message: `Custom provider "${id}" removed` } });
});

/** GET /api/settings/marketplace — List marketplace-available providers */
settingsRoutes.get('/marketplace', async (c) => {
  // Built-in providers that can be discovered via marketplace UI
  const marketplace = BUILT_IN_PROVIDERS.map(p => ({
    id: p.id,
    label: p.label,
    description: `${p.label} LLM provider`,
    baseUrl: p.baseUrl,
    category: 'openai-compatible',
    requiresKey: p.requiresKey,
    docsUrl: p.docsUrl,
    builtIn: true,
  }));

  // Pre-populated popular third-party providers
  const community: Array<{
    id: string;
    label: string;
    description: string;
    baseUrl: string;
    category: string;
    requiresKey: boolean;
    docsUrl?: string;
    builtIn: boolean;
  }> = [
    {
      id: 'together',
      label: 'Together AI',
      description: 'Hosted open-source models via Together AI',
      baseUrl: 'https://api.together.xyz/v1',
      category: 'openai-compatible',
      requiresKey: true,
      docsUrl: 'https://docs.together.ai/',
      builtIn: false,
    },
    {
      id: 'groq',
      label: 'Groq',
      description: 'Fast inference on open-source models via Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      category: 'openai-compatible',
      requiresKey: true,
      docsUrl: 'https://console.groq.com/docs/',
      builtIn: false,
    },
    {
      id: 'perplexity',
      label: 'Perplexity AI',
      description: 'Perplexity AI chat models',
      baseUrl: 'https://api.perplexity.ai',
      category: 'openai-compatible',
      requiresKey: true,
      docsUrl: 'https://docs.perplexity.ai/',
      builtIn: false,
    },
    {
      id: 'mistral',
      label: 'Mistral AI',
      description: 'Mistral AI models (Le Chat, etc.)',
      baseUrl: 'https://api.mistral.ai/v1',
      category: 'openai-compatible',
      requiresKey: true,
      docsUrl: 'https://docs.mistral.ai/',
      builtIn: false,
    },
    {
      id: 'cohere',
      label: 'Cohere',
      description: 'Cohere command models',
      baseUrl: 'https://api.cohere.ai/v1',
      category: 'openai-compatible',
      requiresKey: true,
      docsUrl: 'https://docs.cohere.com/',
      builtIn: false,
    },
    {
      id: 'fireworks',
      label: 'Fireworks AI',
      description: 'Fast inference platform for open-source models',
      baseUrl: 'https://api.fireworks.ai/inference/v1',
      category: 'openai-compatible',
      requiresKey: true,
      docsUrl: 'https://docs.fireworks.ai/',
      builtIn: false,
    },
  ];

  return c.json({
    success: true,
    data: {
      builtIn: marketplace,
      community,
    },
  });
});

// ── Integration management ────────────────────────────────

/** GET /api/settings/integrations — List all integrations */
settingsRoutes.get('/integrations', async (c) => {
  const store = new SettingsStore(c.env.VFS_CACHE);
  const settings = await store.load();
  const integrations = Object.entries(settings.integrations).map(([type, s]) => ({
    type,
    enabled: s.enabled,
    label: s.label || type,
    configured: Object.keys(s.config ?? {}).length > 0,
    config: s.config,
  }));
  return c.json({ success: true, data: integrations });
});

/** PUT /api/settings/integrations/:type — Upsert an integration */
settingsRoutes.put('/integrations/:type', async (c) => {
  const type = c.req.param('type');
  const store = new SettingsStore(c.env.VFS_CACHE);
  const body = await c.req.json<{
    enabled?: boolean;
    config?: Record<string, unknown>;
    label?: string;
  }>();

  const existing = await store.getIntegration(type);
  await store.upsertIntegration(type, {
    type,
    enabled: body.enabled ?? existing?.enabled ?? false,
    config: body.config ?? existing?.config ?? {},
    label: body.label ?? existing?.label ?? type,
  });

  return c.json({ success: true, data: { message: `Integration "${type}" updated` } });
});

/** DELETE /api/settings/integrations/:type — Remove an integration */
settingsRoutes.delete('/integrations/:type', async (c) => {
  const type = c.req.param('type');
  const store = new SettingsStore(c.env.VFS_CACHE);
  await store.deleteIntegration(type);
  return c.json({ success: true, data: { message: `Integration "${type}" removed` } });
});

/** PUT /api/settings/integrations/github — Quick GitHub config */
settingsRoutes.put('/integrations/github', async (c) => {
  const store = new SettingsStore(c.env.VFS_CACHE);
  const body = await c.req.json<{
    token?: string;
    owner?: string;
    repo?: string;
    branch?: string;
    autoSync?: boolean;
    enabled?: boolean;
  }>();

  const existing = await store.getIntegration('github');
  const config = {
    token: body.token || (existing?.config as any)?.token,
    owner: body.owner || (existing?.config as any)?.owner,
    repo: body.repo || (existing?.config as any)?.repo,
    branch: body.branch || (existing?.config as any)?.branch || 'main',
    autoSync: body.autoSync ?? (existing?.config as any)?.autoSync ?? false,
  };

  await store.upsertIntegration('github', {
    type: 'github',
    enabled: body.enabled ?? existing?.enabled ?? false,
    config,
    label: 'GitHub',
  });

  return c.json({ success: true, data: { message: 'GitHub integration updated' } });
});

/** PUT /api/settings/integrations/skills — Quick skills config */
settingsRoutes.put('/integrations/skills', async (c) => {
  const store = new SettingsStore(c.env.VFS_CACHE);
  const body = await c.req.json<{
    enabledList?: string[];
    autoDiscover?: boolean;
    customSkillDirs?: string[];
    enabled?: boolean;
  }>();

  const existing = await store.getIntegration('skills');
  const config = {
    enabledList: body.enabledList ?? (existing?.config as any)?.enabledList ?? [],
    autoDiscover: body.autoDiscover ?? (existing?.config as any)?.autoDiscover ?? true,
    customSkillDirs: body.customSkillDirs ?? (existing?.config as any)?.customSkillDirs ?? [],
  };

  await store.upsertIntegration('skills', {
    type: 'skills',
    enabled: body.enabled ?? existing?.enabled ?? true,
    config,
    label: 'Skills',
  });

  return c.json({ success: true, data: { message: 'Skills integration updated' } });
});

// ── Telegram settings (multi-bot) ─────────────────────────

/** GET /api/settings/telegram — Get all Telegram bot configs */
settingsRoutes.get('/telegram', async (c) => {
  const store = new SettingsStore(c.env.VFS_CACHE);
  const settings = await store.getTelegramSettings();

  // Return bot configs with token presence indicator
  const safeBots = settings.bots.map((b) => ({
    ...b,
    hasBotToken: !!b.botToken,
    botToken: undefined,
  }));

  return c.json({
    success: true,
    data: {
      bots: safeBots,
      hasBotToken: settings.bots.some(b => !!b.botToken),
      webhookBaseUrl: settings.webhookBaseUrl,
      botCount: settings.bots.length,
    },
  });
});

/** PUT /api/settings/telegram — Update Telegram settings */
settingsRoutes.put('/telegram', async (c) => {
  const store = new SettingsStore(c.env.VFS_CACHE);
  const settings = await store.load();
  const body = await c.req.json<{
    bots?: TelegramBotConfig[];
    webhookBaseUrl?: string;
  }>();

  // Merge bot tokens from existing configs
  if (body.bots) {
    for (const bot of body.bots) {
      const existing = settings.telegram.bots.find(b => b.botId === bot.botId);
      if (!bot.botToken && existing?.botToken) {
        bot.botToken = existing.botToken;
      }
    }
    settings.telegram.bots = body.bots;
  }
  if (body.webhookBaseUrl !== undefined) {
    settings.telegram.webhookBaseUrl = body.webhookBaseUrl;
  }

  await store.save(settings);
  return c.json({ success: true, data: { message: 'Telegram settings updated' } });
});

/** PUT /api/settings/telegram/bots/:botId — Upsert a single bot config */
settingsRoutes.put('/telegram/bots/:botId', async (c) => {
  const botId = c.req.param('botId');
  const store = new SettingsStore(c.env.VFS_CACHE);
  const body = await c.req.json<TelegramBotConfig>();

  await store.upsertTelegramBot({ ...body, botId });
  return c.json({ success: true, data: { message: `Bot "${botId}" saved` } });
});

/** DELETE /api/settings/telegram/bots/:botId — Delete a bot config */
settingsRoutes.delete('/telegram/bots/:botId', async (c) => {
  const botId = c.req.param('botId');
  const store = new SettingsStore(c.env.VFS_CACHE);
  await store.deleteTelegramBot(botId);
  return c.json({ success: true, data: { message: `Bot "${botId}" removed` } });
});

/** POST /api/settings/telegram/bots/:botId/set-webhook — Register webhook with Telegram */
settingsRoutes.post('/telegram/bots/:botId/set-webhook', async (c) => {
  const botId = c.req.param('botId');
  const store = new SettingsStore(c.env.VFS_CACHE);
  const bot = await store.getTelegramBot(botId);
  const settings = await store.load();

  if (!bot || !bot.botToken) {
    return c.json({ success: false, error: { code: 'NO_BOT_TOKEN', message: 'Bot token not configured' } }, 400);
  }

  const baseUrl = settings.telegram.webhookBaseUrl || c.req.header('x-forwarded-host') || `${c.req.url.split('/')[2]}`;
  const webhookUrl = `${baseUrl}/webhook/telegram/${botId}`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${bot.botToken}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      },
    );
    const result = await response.json();

    if (response.ok) {
      bot.webhookUrl = webhookUrl;
      bot.webhookSetAt = Date.now();
      await store.upsertTelegramBot(bot);
    }

    return c.json({ success: response.ok, data: result });
  } catch (err) {
    return c.json({ success: false, error: { code: 'WEBHOOK_FAILED', message: err instanceof Error ? err.message : 'Failed' } }, 500);
  }
});

/** POST /api/settings/telegram/bots/:botId/delete-webhook — Remove Telegram webhook */
settingsRoutes.post('/telegram/bots/:botId/delete-webhook', async (c) => {
  const botId = c.req.param('botId');
  const store = new SettingsStore(c.env.VFS_CACHE);
  const bot = await store.getTelegramBot(botId);

  if (!bot || !bot.botToken) {
    return c.json({ success: false, error: { code: 'NO_BOT_TOKEN', message: 'Bot token not configured' } }, 400);
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${bot.botToken}/deleteWebhook`,
    );
    const result = await response.json();
    return c.json({ success: response.ok, data: result });
  } catch (err) {
    return c.json({ success: false, error: { code: 'WEBHOOK_DELETE_FAILED', message: err instanceof Error ? err.message : 'Failed' } }, 500);
  }
});

export { settingsRoutes };
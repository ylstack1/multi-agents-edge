import { Hono } from 'hono';
import { SettingsStore } from '../settings-store.js';
import { createProviderFromSettings, fetchProviderModels, getRegisteredProviders, DEFAULT_MODELS } from '@midas/ai-provider';
import type { Env } from '../../worker-configuration.d.ts';

const settingsRoutes = new Hono<{ Bindings: Env }>();

// ── Full settings ────────────────────────────────────────

/** GET /api/settings — Load all settings */
settingsRoutes.get('/', async (c) => {
  const store = new SettingsStore(c.env.VFS_CACHE);
  const settings = await store.load();
  // Never expose API keys in responses
  const safe = JSON.parse(JSON.stringify(settings));
  for (const key of Object.keys(safe.providers)) {
    delete safe.providers[key].apiKey;
  }
  delete safe.telegram.botToken;
  return c.json({ success: true, data: safe });
});

/** PUT /api/settings — Save all settings */
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
  if (!body.telegram?.botToken && existing.telegram.botToken) {
    body.telegram.botToken = existing.telegram.botToken;
  }

  const merged = { ...existing, ...body, providers: { ...existing.providers, ...body.providers } };
  await store.save(merged as any);
  return c.json({ success: true, data: { message: 'Settings saved' } });
});

// ── Provider management ─────────────────────────────────

/** GET /api/settings/providers — List all providers */
settingsRoutes.get('/providers', async (c) => {
  const store = new SettingsStore(c.env.VFS_CACHE);
  const settings = await store.load();
  const providers = getRegisteredProviders().map((name) => {
    const saved = settings.providers[name];
    return {
      provider: name,
      enabled: saved?.enabled ?? name === 'workers-ai',
      defaultModel: saved?.defaultModel ?? '',
      models: saved?.models ?? DEFAULT_MODELS[name] ?? [],
      hasApiKey: !!(saved?.apiKey),
    };
  });
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

  if (!setting || !setting.apiKey) {
    return c.json({ success: false, error: { code: 'NO_KEY', message: 'No API key configured' } }, 400);
  }

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
      error: { code: 'TEST_FAILED', message: err instanceof Error ? err.message : 'Test failed' },
    }, 400);
  }
});

/** POST /api/settings/providers/:provider/models — Fetch available models */
settingsRoutes.post('/providers/:provider/models', async (c) => {
  const provider = c.req.param('provider');
  const store = new SettingsStore(c.env.VFS_CACHE);
  const setting = await store.getProvider(provider);

  if (!setting?.apiKey) {
    // Return default models if no key
    return c.json({ success: true, data: { models: DEFAULT_MODELS[provider] ?? [] } });
  }

  const models = await fetchProviderModels(provider, setting.apiKey, setting.baseUrl);
  const allModels = [...new Set([...(DEFAULT_MODELS[provider] ?? []), ...models])];
  return c.json({ success: true, data: { models: allModels, fetched: models } });
});

/** GET /api/settings/providers/registered — List all registered provider types */
settingsRoutes.get('/providers/registered', async (c) => {
  const providers = getRegisteredProviders().map((name) => ({
    provider: name,
    models: DEFAULT_MODELS[name] ?? [],
    requiresKey: name !== 'workers-ai',
  }));
  return c.json({ success: true, data: providers });
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
    configured: !!s.config,
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
  const existing = await store.load();
  delete existing.integrations[type];
  await store.save(existing);
  return c.json({ success: true, data: { message: `Integration "${type}" removed` } });
});

// ── Telegram settings ─────────────────────────────────────

/** GET /api/settings/telegram — Get Telegram config */
settingsRoutes.get('/telegram', async (c) => {
  const store = new SettingsStore(c.env.VFS_CACHE);
  const config = await store.getTelegramConfig();
  // Don't expose bot token
  return c.json({ success: true, data: { ...config, hasBotToken: !!config.botToken } });
});

/** PUT /api/settings/telegram — Update Telegram config */
settingsRoutes.put('/telegram', async (c) => {
  const store = new SettingsStore(c.env.VFS_CACHE);
  const settings = await store.load();
  const body = await c.req.json<{
    botToken?: string;
    leadAgentId?: string;
    agentMappings?: Record<string, string>;
  }>();

  settings.telegram = {
    botToken: body.botToken || settings.telegram.botToken,
    leadAgentId: body.leadAgentId ?? settings.telegram.leadAgentId,
    agentMappings: body.agentMappings ?? settings.telegram.agentMappings,
  };
  await store.save(settings);

  return c.json({ success: true, data: { message: 'Telegram settings updated' } });
});

export { settingsRoutes };
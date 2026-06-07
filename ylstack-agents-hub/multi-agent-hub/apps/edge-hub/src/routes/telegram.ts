import { Hono } from 'hono';
import type { Env } from '../../worker-configuration.d.ts';
import { TelegramWebhookHandler } from '../telegram/webhook-handler.js';
import { SettingsStore } from '../settings-store.js';

const telegramRoutes = new Hono<{ Bindings: Env }>();

/**
 * Multi-bot Telegram webhook endpoints.
 * Mounted at /webhook/telegram
 *
 * Routes:
 *   POST /webhook/telegram              — General webhook (legacy, uses first bot or env var)
 *   POST /webhook/telegram/:botId       — Per-bot webhook
 *   POST /webhook/telegram/set-webhook  — Set webhook URL
 *   POST /webhook/telegram/webhook-info — Get webhook info
 */

// General webhook (legacy, uses first bot or env var)
telegramRoutes.post('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const handler = new TelegramWebhookHandler(c.env, 'default');
  return handler.handle(body);
});

// Per-bot webhook — each bot has its own URL
telegramRoutes.post('/:botId', async (c) => {
  const botId = c.req.param('botId');
  // Skip if this matches set-webhook or webhook-info routes
  if (botId === 'set-webhook' || botId === 'webhook-info') {
    return c.json({ ok: true });
  }
  const body = await c.req.json<Record<string, unknown>>();
  const handler = new TelegramWebhookHandler(c.env, botId);
  return handler.handle(body);
});

// Set webhook for a specific bot
telegramRoutes.post('/set-webhook', async (c) => {
  const { url, botId } = await c.req.json<{ url: string; botId?: string }>();
  const store = new SettingsStore(c.env.VFS_CACHE);

  let botToken: string | undefined;
  if (botId) {
    const bot = await store.getTelegramBot(botId);
    botToken = bot?.botToken;
  }
  if (!botToken) {
    botToken = c.env.TELEGRAM_BOT_TOKEN;
  }

  if (!botToken) {
    return c.json({
      success: false,
      error: { code: 'NO_BOT_TOKEN', message: 'Telegram bot token not configured' },
    }, 500);
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      },
    );
    const result = await response.json();
    return c.json({ success: response.ok, data: result });
  } catch (err) {
    return c.json({
      success: false,
      error: { code: 'WEBHOOK_FAILED', message: err instanceof Error ? err.message : 'Failed' },
    }, 500);
  }
});

// Get webhook info for a bot
telegramRoutes.post('/webhook-info', async (c) => {
  const { botId } = await c.req.json<{ botId?: string }>();
  const store = new SettingsStore(c.env.VFS_CACHE);

  let botToken: string | undefined;
  if (botId) {
    const bot = await store.getTelegramBot(botId);
    botToken = bot?.botToken;
  }
  if (!botToken) {
    botToken = c.env.TELEGRAM_BOT_TOKEN;
  }

  if (!botToken) {
    return c.json({
      success: false,
      error: { code: 'NO_BOT_TOKEN', message: 'Bot token not configured' },
    }, 500);
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`,
    );
    const result = await response.json();
    return c.json({ success: response.ok, data: result });
  } catch (err) {
    return c.json({
      success: false,
      error: { code: 'WEBHOOK_INFO_FAILED', message: err instanceof Error ? err.message : 'Failed' },
    }, 500);
  }
});

export { telegramRoutes };
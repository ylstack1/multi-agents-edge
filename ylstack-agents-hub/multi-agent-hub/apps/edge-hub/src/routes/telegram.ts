import { Hono } from 'hono';
import type { Env } from '../../worker-configuration.d.ts';

const telegramRoutes = new Hono<{ Bindings: Env }>();

// Telegram webhook endpoint
telegramRoutes.post('/webhook', async (c) => {
  const body = await c.req.json<{
    message?: {
      text?: string;
      chat?: { id: number };
      from?: { id: number; username?: string };
    };
    my_chat_member?: unknown;
  }>();

  // Extract message text
  const messageText = body.message?.text;
  const chatId = body.message?.chat?.id;

  if (!messageText || !chatId) {
    return c.json({ ok: true }); // Acknowledge non-text updates
  }

  // In production, resolve bot token to agent and route to orchestration
  // For now, echo back a confirmation
  const botToken = c.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return c.json({ ok: true });
  }

  // Send acknowledgment via Telegram API
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Received: "${messageText}"\n\nProcessing via Multi-Agent Hub...`,
      }),
    },
  );

  if (!response.ok) {
    console.error('Telegram API error:', await response.text());
  }

  return c.json({ ok: true });
});

// Set webhook URL
telegramRoutes.post('/set-webhook', async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  const botToken = c.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return c.json({ success: false, error: { code: 'NO_BOT_TOKEN', message: 'Telegram bot token not configured' } }, 500);
  }

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
});

export { telegramRoutes };
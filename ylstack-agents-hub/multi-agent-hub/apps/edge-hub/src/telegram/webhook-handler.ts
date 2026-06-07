import type { Env } from '../../worker-configuration.d.ts';
import { parseTelegramMessage } from './message-parser.js';
import { TelegramAPIClient } from './api-client.js';

/**
 * Telegram webhook handler.
 * Routes incoming messages to the appropriate agent based on bot token.
 */
export class TelegramWebhookHandler {
  private env: Env;
  private apiClient: TelegramAPIClient;

  constructor(env: Env, botToken?: string) {
    this.env = env;
    this.apiClient = new TelegramAPIClient(botToken ?? env.TELEGRAM_BOT_TOKEN ?? '');
  }

  async handle(payload: Record<string, unknown>): Promise<Response> {
    const parsed = parseTelegramMessage(payload);

    if (!parsed) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Drop media messages
    if (parsed.hasMedia) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Handle commands
    if (parsed.isCommand) {
      await this.handleCommand(parsed);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // In production: route to Lead Agent or Sub-agent based on binding
    // For now, echo a response
    await this.apiClient.sendChatAction(parsed.chatId, 'typing');

    // Simulate processing delay
    await this.apiClient.sendMessage(
      parsed.chatId,
      `🤖 *Multi-Agent Hub*\n\nReceived your message: "${parsed.text}"\n\n_Agent processing will be available in the full deployment._`,
      { parseMode: 'MarkdownV2' },
    );

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  private async handleCommand(parsed: {
    chatId: number;
    command?: string;
    commandArgs?: string;
  }): Promise<void> {
    switch (parsed.command) {
      case '/start':
        await this.apiClient.sendMessage(
          parsed.chatId,
          'Welcome to the Multi-Agent Hub! 🤖\n\nInteract with AI agents powered by markdown-defined personalities.',
        );
        break;

      case '/help':
        await this.apiClient.sendMessage(
          parsed.chatId,
          'Available commands:\n/start - Welcome message\n/help - This help\n/debug - Toggle debug mode (admin only)',
        );
        break;

      default:
        await this.apiClient.sendMessage(
          parsed.chatId,
          `Unknown command: ${parsed.command}`,
        );
    }
  }
}
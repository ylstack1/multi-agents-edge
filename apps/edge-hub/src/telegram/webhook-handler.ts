import type { Env } from '../../worker-configuration.d.ts';
import { parseTelegramMessage } from './message-parser.js';
import { TelegramAPIClient } from './api-client.js';
import { SettingsStore } from '../settings-store.js';

/**
 * Telegram webhook handler with multi-bot and lead agent support.
 *
 * Architecture:
 * - Each bot has its own configuration (token, lead agent, per-chat mappings)
 * - Lead agent: has omnipotent capabilities (can spawn/modify sub-agents)
 * - Mapped agents: handle specific chat conversations
 * - Unmapped chats: routed to the bot's default agent (or lead agent)
 */
export class TelegramWebhookHandler {
  private env: Env;
  private botId: string;
  private apiClient?: TelegramAPIClient;

  constructor(env: Env, botId: string = 'default') {
    this.env = env;
    this.botId = botId;
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

    // Resolve bot token and agent from settings
    const store = new SettingsStore(this.env.VFS_CACHE);
    const bot = await store.getTelegramBot(this.botId);

    if (!bot || !bot.botToken) {
      // Fallback to env var
      const token = this.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        console.error(`No Telegram bot token for botId: ${this.botId}`);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      this.apiClient = new TelegramAPIClient(token);
    } else {
      this.apiClient = new TelegramAPIClient(bot.botToken);
    }

    // Check if chat is allowed
    if (bot?.allowedChatIds && bot.allowedChatIds.length > 0) {
      if (!bot.allowedChatIds.includes(parsed.chatId)) {
        await this.apiClient.sendMessage(
          parsed.chatId,
          'Sorry, you are not authorized to use this bot.',
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
    }

    // Resolve which agent handles this chat
    const { agentId } = await store.resolveTelegramAgent(this.botId, parsed.chatId);

    // Handle commands
    if (parsed.isCommand) {
      await this.handleCommand(parsed, agentId);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Route to the resolved agent via lead agent orchestration
    await this.routeToAgent(parsed, agentId);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  private async handleCommand(
    parsed: {
      chatId: number;
      command?: string;
      commandArgs?: string;
      text?: string;
    },
    agentId: string,
  ): Promise<void> {
    if (!this.apiClient) return;

    switch (parsed.command) {
      case '/start':
        await this.apiClient.sendMessage(
          parsed.chatId,
          `🤖 *Multi-Agent Hub*\n\nWelcome! You are connected to agent: \`${agentId}\`\n\nI'm powered by markdown-defined AI agents. Send me a message and I'll process it with the appropriate agent.`,
          { parseMode: 'MarkdownV2' },
        );
        break;

      case '/help':
        await this.apiClient.sendMessage(
          parsed.chatId,
          `Available commands:\n/start - Welcome message\n/help - Show this help\n/agent - Show current agent\n/agents - List available agents`,
        );
        break;

      case '/agent':
        await this.apiClient.sendMessage(
          parsed.chatId,
          `Current agent: \`${agentId}\`\n\nThis agent handles your conversations.`,
          { parseMode: 'MarkdownV2' },
        );
        break;

      default:
        // Unknown commands are forwarded to the agent as messages
        if (parsed.text) {
          await this.routeToAgent(parsed, agentId);
        }
    }
  }

  /**
   * Route a user message to the designated agent.
   * Lead agent can orchestrate and manage sub-agents.
   * Other agents handle their designated workspace.
   */
  private async routeToAgent(
    parsed: {
      chatId: number;
      text?: string;
      userId?: number;
      username?: string;
    },
    agentId: string,
  ): Promise<void> {
    if (!this.apiClient || !parsed.text) return;

    // Send typing indicator
    await this.apiClient.sendChatAction(parsed.chatId, 'typing');

    try {
      // Build the request to the chat endpoint
      const url = `${this.env.WEBHOOK_BASE_URL || 'http://localhost:8787'}/api/chat/${encodeURIComponent(agentId)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'TELEGRAM',
          'X-Session-Token': btoa(`${agentId}:telegram`),
        },
        body: JSON.stringify({
          message: parsed.text,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        await this.apiClient.sendMessage(
          parsed.chatId,
          `⚠️ Error processing your request: ${response.status}\n\`\`\`\n${errBody.slice(0, 500)}\n\`\`\``,
          { parseMode: 'MarkdownV2' },
        );
        return;
      }

      const result = await response.json() as any;
      const content = result?.data?.content || 'No response generated.';
      const provider = result?.data?.provider || '';
      const model = result?.data?.model || '';

      // Escape special characters for MarkdownV2
      const escaped = content
        .replace(/_/g, '\\_')
        .replace(/\*/g, '\\*')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/~/g, '\\~')
        .replace(/`/g, '\\`')
        .replace(/>/g, '\\>')
        .replace(/#/g, '\\#')
        .replace(/\+/g, '\\+')
        .replace(/-/g, '\\-')
        .replace(/=/g, '\\=')
        .replace(/\|/g, '\\|')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\./g, '\\.')
        .replace(/!/g, '\\!');

      await this.apiClient.sendMessage(
        parsed.chatId,
        `${escaped}\n\n— _via ${provider}/${model}_`,
        { parseMode: 'MarkdownV2' },
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      await this.apiClient.sendMessage(
        parsed.chatId,
        `⚠️ Error: ${errMsg}`,
      );
    }
  }
}
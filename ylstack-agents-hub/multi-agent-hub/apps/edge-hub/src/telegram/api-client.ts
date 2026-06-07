/**
 * Telegram Bot API client.
 * Pure fetch-based — works in edge runtimes.
 */
export class TelegramAPIClient {
  private botToken: string;
  private baseUrl: string;

  constructor(botToken: string) {
    this.botToken = botToken;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async sendMessage(chatId: number, text: string, options?: {
    parseMode?: 'HTML' | 'MarkdownV2';
    replyToMessageId?: number;
  }): Promise<boolean> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
    };

    if (options?.parseMode) body.parse_mode = options.parseMode;
    if (options?.replyToMessageId) body.reply_to_message_id = options.replyToMessageId;

    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return response.ok;
  }

  async sendChatAction(chatId: number, action: 'typing' | 'upload_photo' | 'record_voice'): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
    return response.ok;
  }

  async setWebhook(url: string): Promise<{ ok: boolean; description?: string }> {
    const response = await fetch(`${this.baseUrl}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return response.json() as Promise<{ ok: boolean; description?: string }>;
  }

  async deleteWebhook(): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/deleteWebhook`, {
      method: 'POST',
    });
    return response.ok;
  }
}
export interface ParsedTelegramMessage {
  chatId: number;
  userId: number;
  username?: string;
  text: string;
  messageId: number;
  isCommand: boolean;
  command?: string;
  commandArgs?: string;
  hasMedia: boolean;
}

/**
 * Parse Telegram webhook payloads.
 * Extracts text content and drops unsupported media types.
 */
export function parseTelegramMessage(payload: Record<string, unknown>): ParsedTelegramMessage | null {
  const message = payload.message as Record<string, unknown> | undefined;
  if (!message) return null;

  const chat = message.chat as Record<string, unknown> | undefined;
  const from = message.from as Record<string, unknown> | undefined;
  const text = message.text as string | undefined;

  if (!chat || !from) return null;

  const chatId = chat.id as number;
  const userId = from.id as number;

  // Check for media (drop these)
  if (
    message.photo ||
    message.video ||
    message.audio ||
    message.document ||
    message.sticker ||
    message.voice
  ) {
    return {
      chatId,
      userId,
      username: from.username as string | undefined,
      text: text ?? '',
      messageId: (message.message_id as number) ?? 0,
      isCommand: false,
      hasMedia: true,
    };
  }

  // Extract command if present
  let isCommand = false;
  let command: string | undefined;
  let commandArgs: string | undefined;

  if (text?.startsWith('/')) {
    isCommand = true;
    const parts = text.split(/\s+/);
    command = parts[0]?.toLowerCase();
    commandArgs = parts.slice(1).join(' ');
  }

  return {
    chatId,
    userId,
    username: from.username as string | undefined,
    text: text ?? '',
    messageId: (message.message_id as number) ?? 0,
    isCommand,
    command,
    commandArgs,
    hasMedia: false,
  };
}
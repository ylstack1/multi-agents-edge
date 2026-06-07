import type { LLMStreamChunk, LLMProvider } from '@midas/contracts';
import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from './types.js';

/**
 * Anthropic provider implementation.
 * Uses standard Web Fetch API — compatible with edge runtimes.
 */
export class AnthropicProvider implements AIProvider {
  readonly name: LLMProvider = 'anthropic';
  private apiKey: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey ?? '';
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(this.buildRequestBody(req)),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
    }

    const json = (await response.json()) as {
      content: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>;
      stop_reason: string;
      usage?: { input_tokens: number; output_tokens: number };
    };

    const textContent = json.content.find((c) => c.type === 'text');
    const toolUseContent = json.content.find((c) => c.type === 'tool_use');

    return {
      content: textContent?.text ?? null,
      toolCalls: toolUseContent
        ? [
            {
              id: crypto.randomUUID(),
              type: 'function' as const,
              function: {
                name: toolUseContent.name ?? 'unknown',
                arguments: JSON.stringify(toolUseContent.input ?? {}),
              },
            },
          ]
        : undefined,
      finishReason: this.mapFinishReason(json.stop_reason),
      usage: json.usage
        ? {
            promptTokens: json.usage.input_tokens,
            completionTokens: json.usage.output_tokens,
            totalTokens: json.usage.input_tokens + json.usage.output_tokens,
          }
        : undefined,
    };
  }

  async *streamComplete(req: CompletionRequest): AsyncGenerator<LLMStreamChunk> {
    const body = this.buildRequestBody(req);
    body.stream = true;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      yield { type: 'error', error: `Anthropic API error ${response.status}: ${errorBody}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body stream' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const chunk = this.parseSSEChunk(line);
          if (chunk) yield chunk;
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done' };
  }

  private buildRequestBody(req: CompletionRequest): Record<string, unknown> {
    return {
      model: req.config.model,
      system: req.systemPrompt,
      messages: req.messages.map((m) => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })),
      tools: req.tools?.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      })),
      max_tokens: req.config.maxTokens,
      temperature: req.config.temperature,
      stream: false,
    };
  }

  private parseSSEChunk(line: string): LLMStreamChunk | null {
    if (!line.startsWith('data: ')) return null;
    const data = line.slice(6).trim();
    if (data === '[DONE]') return null;

    try {
      const json = JSON.parse(data) as {
        type?: string;
        delta?: { text?: string; type?: string; thinking?: string };
        content_block?: { type?: string; name?: string; input?: Record<string, unknown>; thinking?: string };
        index?: number;
      };

      // Anthropic thinking blocks
      if (json.type === 'content_block_start' && json.content_block?.type === 'thinking') {
        return { type: 'reasoning', reasoning: json.content_block.thinking ?? '' };
      }

      if (json.type === 'content_block_delta' && json.delta?.type === 'thinking_delta') {
        return { type: 'reasoning', reasoning: json.delta.thinking ?? '' };
      }

      if (json.type === 'content_block_delta' && json.delta?.text) {
        return { type: 'text', content: json.delta.text };
      }

      if (json.type === 'content_block_start' && json.content_block?.type === 'tool_use') {
        return {
          type: 'tool_call',
          toolCallId: `call_${json.index}`,
          toolName: json.content_block.name,
          arguments: JSON.stringify(json.content_block.input ?? {}),
        };
      }

      if (json.type === 'message_stop') {
        return { type: 'done' };
      }

      return null;
    } catch {
      return null;
    }
  }

  private mapFinishReason(stopReason: string): CompletionResponse['finishReason'] {
    switch (stopReason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'tool_use':
        return 'tool_calls';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }
}
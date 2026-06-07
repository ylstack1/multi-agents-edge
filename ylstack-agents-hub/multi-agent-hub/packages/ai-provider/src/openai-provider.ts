import type { LLMStreamChunk, LLMProvider } from '@midas/contracts';
import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from './types.js';

/**
 * OpenAI provider implementation.
 * Uses standard Web Fetch API — compatible with edge runtimes.
 */
export class OpenAIProvider implements AIProvider {
  readonly name: LLMProvider = 'openai';
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey ?? '';
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com';
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(this.buildRequestBody(req)),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
    }

    const json = (await response.json()) as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{
            id: string;
            type: 'function';
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const choice = json.choices[0];
    if (!choice) {
      throw new Error('OpenAI returned no choices');
    }

    return {
      content: choice.message.content,
      toolCalls: choice.message.tool_calls,
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *streamComplete(req: CompletionRequest): AsyncGenerator<LLMStreamChunk> {
    const body = this.buildRequestBody(req);
    body.stream = true;

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      yield { type: 'error', error: `OpenAI API error ${response.status}: ${errorBody}` };
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
      messages: [
        { role: 'system', content: req.systemPrompt },
        ...req.messages.map((m) => ({
          role: m.role,
          content: m.content,
          tool_calls: m.tool_calls,
          tool_call_id: m.tool_call_id,
        })),
      ],
      tools: req.tools,
      temperature: req.config.temperature,
      max_tokens: req.config.maxTokens,
      stream: false,
    };
  }

  private parseSSEChunk(line: string): LLMStreamChunk | null {
    if (!line.startsWith('data: ')) return null;
    const data = line.slice(6).trim();
    if (data === '[DONE]') return null;

    try {
      const json = JSON.parse(data) as {
        choices?: Array<{
          delta: {
            content?: string;
            tool_calls?: Array<{
              index: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          finish_reason?: string;
        }>;
      };

      const choice = json.choices?.[0];
      if (!choice) return null;

      if (choice.finish_reason) {
        return { type: 'done' };
      }

      const delta = choice.delta;
      if (delta.tool_calls?.[0]) {
        const tc = delta.tool_calls[0];
        if (tc?.id) {
          return {
            type: 'tool_call',
            toolCallId: tc.id,
            toolName: tc.function?.name,
            arguments: tc.function?.arguments,
          };
        }
        if (tc?.function?.arguments) {
          return {
            type: 'tool_call',
            arguments: tc.function.arguments,
          };
        }
      }

      if (delta.content) {
        return { type: 'text', content: delta.content };
      }

      return null;
    } catch {
      return null;
    }
  }

  private mapFinishReason(finishReason: string): CompletionResponse['finishReason'] {
    switch (finishReason) {
      case 'stop':
        return 'stop';
      case 'tool_calls':
        return 'tool_calls';
      case 'length':
        return 'length';
      default:
        return 'stop';
    }
  }
}
import type { LLMStreamChunk, LLMProvider } from '@midas/contracts';
import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from './types.js';

/** DeepSeek provider — OpenAI-compatible API format */
export class DeepSeekProvider implements AIProvider {
  readonly name: LLMProvider = 'deepseek';
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey ?? '';
    this.baseUrl = config.baseUrl ?? 'https://api.deepseek.com';
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const model = req.config.model || 'deepseek-chat';
    const body = {
      model,
      messages: this.buildMessages(req),
      temperature: req.config.temperature,
      max_tokens: req.config.maxTokens,
    };

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DeepSeek API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as any;
    return this.parseResponse(data);
  }

  async *streamComplete(
    req: CompletionRequest,
  ): AsyncGenerator<LLMStreamChunk> {
    const model = req.config.model || 'deepseek-chat';
    const body = {
      model,
      messages: this.buildMessages(req),
      temperature: req.config.temperature,
      max_tokens: req.config.maxTokens,
      stream: true,
    };

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      yield { type: 'error', error: `DeepSeek error: ${text}` } as LLMStreamChunk;
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const delta = data?.choices?.[0]?.delta ?? {};
            // Extract reasoning_content (DeepSeek R1)
            const reasoningDelta = delta.reasoning_content;
            if (reasoningDelta) {
              yield { type: 'reasoning', reasoning: reasoningDelta } as LLMStreamChunk;
            }
            const textDelta = delta.content ?? '';
            if (textDelta) {
              yield { type: 'text', content: textDelta } as LLMStreamChunk;
            }
          } catch { /* skip */ }
        }
      }
    }
    yield { type: 'done' } as LLMStreamChunk;
  }

  private buildMessages(req: CompletionRequest) {
    const msgs: Array<{ role: string; content: string }> = [];
    if (req.systemPrompt) {
      msgs.push({ role: 'system', content: req.systemPrompt });
    }
    for (const m of req.messages) {
      msgs.push({ role: m.role, content: m.content ?? '' });
    }
    return msgs;
  }

  private parseResponse(data: any): CompletionResponse {
    const choice = data?.choices?.[0];
    return {
      content: choice?.message?.content ?? null,
      finishReason: this.mapFinish(choice?.finish_reason),
    };
  }

  private mapFinish(reason?: string): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'stop': return 'stop';
      case 'tool_calls': return 'tool_calls';
      case 'length': return 'length';
      default: return 'stop';
    }
  }
}

export const DEEPSEEK_MODELS = ['deepseek-chat', 'deepseek-reasoner'];
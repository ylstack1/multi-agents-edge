import type { LLMStreamChunk, LLMProvider } from '@midas/contracts';
import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from './types.js';

/** OpenRouter provider — routes through any model via unified API */
export class OpenRouterProvider implements AIProvider {
  readonly name: LLMProvider = 'openrouter';
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey ?? '';
    this.baseUrl = config.baseUrl ?? 'https://openrouter.ai/api';
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const model = req.config.model || 'openai/gpt-4o';
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
        'HTTP-Referer': 'https://multi-agent-hub.pages.dev',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as any;
    return this.parseResponse(data);
  }

  async *streamComplete(
    req: CompletionRequest,
  ): AsyncGenerator<LLMStreamChunk> {
    const model = req.config.model || 'openai/gpt-4o';
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
        'HTTP-Referer': 'https://multi-agent-hub.pages.dev',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      yield { type: 'error', error: `OpenRouter error: ${text}` } as LLMStreamChunk;
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
            const delta = data?.choices?.[0]?.delta?.content ?? '';
            if (delta) yield { type: 'text', content: delta } as LLMStreamChunk;
          } catch { /* skip */ }
        }
      }
    }
    yield { type: 'done' } as LLMStreamChunk;
  }

  private buildMessages(req: CompletionRequest) {
    const msgs: Array<{ role: string; content: string }> = [];
    if (req.systemPrompt) msgs.push({ role: 'system', content: req.systemPrompt });
    for (const m of req.messages) msgs.push({ role: m.role, content: m.content ?? '' });
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
      case 'length': return 'length';
      default: return 'stop';
    }
  }
}
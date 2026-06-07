import type { LLMStreamChunk, LLMProvider } from '@midas/contracts';
import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
} from './types.js';

/** Google Gemini provider — uses the Gemini API format */
export class GoogleProvider implements AIProvider {
  readonly name: LLMProvider = 'google';
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey ?? '';
    this.baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const model = req.config.model || 'gemini-2.0-flash';
    const body = this.buildRequestBody(req);

    const res = await fetch(
      `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as any;
    return this.parseResponse(data);
  }

  async *streamComplete(
    req: CompletionRequest,
  ): AsyncGenerator<LLMStreamChunk> {
    const model = req.config.model || 'gemini-2.0-flash';
    const body = this.buildRequestBody(req);

    const res = await fetch(
      `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      yield {
        type: 'error',
        error: `Google API error (${res.status}): ${text}`,
      } as LLMStreamChunk;
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' } as LLMStreamChunk;
      return;
    }

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
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield { type: 'text', content: text } as LLMStreamChunk;
            }
          } catch {
            // skip
          }
        }
      }
    }

    yield { type: 'done' } as LLMStreamChunk;
  }

  private buildRequestBody(req: CompletionRequest) {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (req.systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `[System Instruction]\n${req.systemPrompt}` }],
      });
    }

    for (const m of req.messages) {
      const role = m.role === 'assistant' ? 'model' : m.role;
      contents.push({
        role: role === 'system' ? 'user' : role,
        parts: [{ text: m.content ?? '' }],
      });
    }

    return {
      contents,
      generationConfig: {
        temperature: req.config.temperature,
        maxOutputTokens: req.config.maxTokens,
      },
    };
  }

  private parseResponse(data: any): CompletionResponse {
    const candidate = data?.candidates?.[0];
    const text =
      candidate?.content?.parts?.map((p: any) => p.text).join('') ?? '';

    return {
      content: text || null,
      finishReason: this.mapFinishReason(candidate?.finishReason),
    };
  }

  private mapFinishReason(reason?: string): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      default:
        return 'stop';
    }
  }
}

export const GOOGLE_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-pro-exp-03-25',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b',
];
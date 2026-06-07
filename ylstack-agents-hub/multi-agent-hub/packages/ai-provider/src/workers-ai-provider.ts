import type { LLMStreamChunk, LLMProvider } from '@midas/contracts';
import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
} from './types.js';

/**
 * Cloudflare Workers AI provider — uses the bound `AI` binding.
 * No API key required. Runs on Cloudflare's edge GPUs.
 */
export class WorkersAIProvider implements AIProvider {
  readonly name: LLMProvider = 'workers-ai';
  private ai: Ai;
  private defaultModel: string;

  constructor(ai: Ai, defaultModel = '@cf/meta/llama-3.2-3b-instruct') {
    this.ai = ai;
    this.defaultModel = defaultModel;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const model = req.config.model || this.defaultModel;
    const messages = this.buildMessages(req);

    try {
      const result = await this.ai.run(model as any, {
        messages,
        stream: false,
        max_tokens: req.config.maxTokens,
        temperature: req.config.temperature,
      } as any);

      const response = result as any;
      const content = response?.response ?? '';

      return {
        content,
        finishReason: 'stop',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (err) {
      throw new Error(
        `Workers AI error (${model}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async *streamComplete(
    req: CompletionRequest,
  ): AsyncGenerator<LLMStreamChunk> {
    const model = req.config.model || this.defaultModel;
    const messages = this.buildMessages(req);

    try {
      const result = await this.ai.run(model as any, {
        messages,
        stream: true,
        max_tokens: req.config.maxTokens,
        temperature: req.config.temperature,
      } as any);

      if (result instanceof ReadableStream) {
        const reader = result.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                const delta = data?.response ?? data?.delta ?? '';
                if (delta) {
                  yield {
                    type: 'text',
                    content: delta,
                  } as LLMStreamChunk;
                }
              } catch {
                // skip malformed JSON lines
              }
            }
          }
        }
      } else {
        const response = result as any;
        const content = response?.response ?? '';
        if (content) {
          yield { type: 'text', content } as LLMStreamChunk;
        }
      }

      yield { type: 'done' } as LLMStreamChunk;
    } catch (err) {
      yield {
        type: 'error',
        error: `Workers AI error (${model}): ${err instanceof Error ? err.message : String(err)}`,
      } as LLMStreamChunk;
    }
  }

  private buildMessages(req: CompletionRequest): Array<{
    role: string;
    content: string;
  }> {
    const msgs: Array<{ role: string; content: string }> = [];

    if (req.systemPrompt) {
      msgs.push({ role: 'system', content: req.systemPrompt });
    }

    for (const m of req.messages) {
      msgs.push({ role: m.role, content: m.content ?? '' });
    }

    if (msgs.length === 0) {
      msgs.push({ role: 'user', content: 'Hello' });
    }

    return msgs;
  }
}

export const WORKERS_AI_MODELS = [
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/meta/llama-3.2-1b-instruct',
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.1',
  '@cf/mistral/mistral-small-24b-instruct-2501',
  '@hf/google/gemma-2-2b-it',
  '@hf/google/gemma-2-9b-it',
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  '@cf/qwen/qwen2.5-72b-instruct',
  '@cf/qwen/qwen2.5-32b-instruct',
  '@cf/qwen/qwen2.5-14b-instruct',
  '@cf/qwen/qwen2.5-7b-instruct',
  '@cf/qwen/qwen2-7b-chat',
  '@cf/microsoft/phi-3-mini-4k-instruct',
  '@cf/microsoft/phi-3-medium-4k-instruct',
];
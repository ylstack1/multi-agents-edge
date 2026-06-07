import type { LLMMessage, LLMStreamChunk, LLMConfig } from '@midas/contracts';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface CompletionRequest {
  systemPrompt: string;
  messages: LLMMessage[];
  tools?: ToolDefinition[];
  config: LLMConfig;
}

export interface CompletionResponse {
  content: string | null;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider {
  readonly name: string;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  streamComplete(req: CompletionRequest): AsyncGenerator<LLMStreamChunk>;
}
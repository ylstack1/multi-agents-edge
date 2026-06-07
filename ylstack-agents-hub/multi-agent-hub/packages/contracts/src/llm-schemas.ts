import { z } from 'zod';

export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

export const LLMRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);

export const LLMMessageSchema = z.object({
  role: LLMRoleSchema,
  content: z.string().nullable(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      }),
    )
    .optional(),
  tool_call_id: z.string().optional(),
  name: z.string().optional(),
});

export type LLMMessage = z.infer<typeof LLMMessageSchema>;

export const LLMConfigSchema = z.object({
  model: z.string().default('gpt-4o'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().default(4096),
  stream: z.boolean().default(true),
  provider: z.enum(['openai', 'anthropic']).default('openai'),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

export const LLMCompletionRequestSchema = z.object({
  messages: z.array(LLMMessageSchema),
  config: LLMConfigSchema.optional(),
  tools: z
    .array(
      z.object({
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          description: z.string().optional(),
          parameters: z.record(z.unknown()),
        }),
      }),
    )
    .optional(),
});

export type LLMCompletionRequest = z.infer<typeof LLMCompletionRequestSchema>;

export const CompiledPromptSchema = z.object({
  systemPrompt: z.string(),
  messages: z.array(LLMMessageSchema),
  toolDefinitions: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        inputSchema: z.record(z.unknown()),
      }),
    )
    .optional(),
  estimatedTokens: z.number().positive(),
  sourceFiles: z.array(z.string()),
});

export type CompiledPrompt = z.infer<typeof CompiledPromptSchema>;

export const LLMStreamChunkSchema = z.object({
  type: z.enum(['text', 'tool_call', 'tool_call_end', 'done', 'error']),
  content: z.string().optional(),
  toolCallId: z.string().optional(),
  toolName: z.string().optional(),
  arguments: z.string().optional(),
  error: z.string().optional(),
});

export type LLMStreamChunk = z.infer<typeof LLMStreamChunkSchema>;
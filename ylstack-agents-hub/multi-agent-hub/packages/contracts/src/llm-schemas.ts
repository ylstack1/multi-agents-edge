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

export const LLM_PROVIDERS = [
  'workers-ai',
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'grok',
  'openrouter',
] as const;

export type LLMProvider = (typeof LLM_PROVIDERS)[number];

export const LLMConfigSchema = z.object({
  model: z.string().default('@cf/meta/llama-3.2-3b-instruct'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().default(4096),
  stream: z.boolean().default(true),
  provider: z.enum(LLM_PROVIDERS).default('workers-ai'),
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

// ── Provider & Integration Settings ──────────────────────────────

export const ProviderSettingSchema = z.object({
  provider: z.enum(LLM_PROVIDERS),
  enabled: z.boolean().default(true),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string().default(''),
  models: z.array(z.string()).optional(),
  modelsLastFetched: z.number().optional(),
  customModels: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
});

export type ProviderSetting = z.infer<typeof ProviderSettingSchema>;

export const IntegrationSettingSchema = z.object({
  type: z.string(),
  enabled: z.boolean().default(false),
  config: z.record(z.unknown()).default({}),
  label: z.string().optional(),
});

export type IntegrationSetting = z.infer<typeof IntegrationSettingSchema>;

export const AppSettingsSchema = z.object({
  providers: z.record(z.string(), ProviderSettingSchema).default({}),
  integrations: z.record(z.string(), IntegrationSettingSchema).default({}),
  defaultProvider: z.enum(LLM_PROVIDERS).default('workers-ai'),
  defaultModel: z.string().default('@cf/meta/llama-3.2-3b-instruct'),
  telegram: z.object({
    botToken: z.string().optional(),
    leadAgentId: z.string().default('lead'),
    agentMappings: z.record(z.string(), z.string()).default({}),
  }).default({}),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;
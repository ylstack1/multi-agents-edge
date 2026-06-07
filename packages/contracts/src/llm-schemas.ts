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
  provider: z.string().default('workers-ai'),
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
  type: z.enum(['text', 'tool_call', 'tool_call_end', 'done', 'error', 'reasoning', 'meta']),
  content: z.string().optional(),
  toolCallId: z.string().optional(),
  toolName: z.string().optional(),
  arguments: z.string().optional(),
  error: z.string().optional(),
  reasoning: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

export type LLMStreamChunk = z.infer<typeof LLMStreamChunkSchema>;

// ── Provider & Integration Settings ──────────────────────────────

export const ProviderSettingSchema = z.object({
  provider: z.string(),
  enabled: z.boolean().default(true),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string().default(''),
  models: z.array(z.string()).optional(),
  modelsLastFetched: z.number().optional(),
  customModels: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
  /** If true, this is a user-added custom provider (not built-in) */
  isCustom: z.boolean().optional(),
  /** Provider display label */
  label: z.string().optional(),
});

export type ProviderSetting = z.infer<typeof ProviderSettingSchema>;

export const IntegrationSettingSchema = z.object({
  type: z.string(),
  enabled: z.boolean().default(false),
  config: z.record(z.unknown()).default({}),
  label: z.string().optional(),
});

export type IntegrationSetting = z.infer<typeof IntegrationSettingSchema>;

// ── Custom Provider / Marketplace ─────────────────────────────────

/** Schema for registering a custom provider in the marketplace */
export const CustomProviderRegistrationSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  baseUrl: z.string().url().default(''),
  apiKey: z.string().optional(),
  defaultModel: z.string().default(''),
  models: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
  /** Provider category: openai-compatible, custom-api, etc. */
  category: z.string().default('openai-compatible'),
  /** Optional icon URL for marketplace display */
  iconUrl: z.string().optional(),
  /** Optional description */
  description: z.string().optional(),
});

export type CustomProviderRegistration = z.infer<typeof CustomProviderRegistrationSchema>;

/** Marketplace listing for a discoverable provider */
export const MarketplaceProviderSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  baseUrl: z.string().default(''),
  category: z.string().default('openai-compatible'),
  iconUrl: z.string().optional(),
  docsUrl: z.string().optional(),
  requiresKey: z.boolean().default(true),
  builtIn: z.boolean().default(false),
});

export type MarketplaceProvider = z.infer<typeof MarketplaceProviderSchema>;

// ── GitHub Integration Config ─────────────────────────────────────

export const GitHubIntegrationConfigSchema = z.object({
  token: z.string().optional(),
  owner: z.string().optional(),
  repo: z.string().optional(),
  branch: z.string().default('main'),
  autoSync: z.boolean().default(false),
  webhookSecret: z.string().optional(),
});

export type GitHubIntegrationConfig = z.infer<typeof GitHubIntegrationConfigSchema>;

// ── Skills Integration Config ─────────────────────────────────────

export const SkillIntegrationConfigSchema = z.object({
  enabledList: z.array(z.string()).default([]),
  autoDiscover: z.boolean().default(true),
  customSkillDirs: z.array(z.string()).default([]),
});

export type SkillIntegrationConfig = z.infer<typeof SkillIntegrationConfigSchema>;

// ── Telegram Bot Integration (per-bot config) ─────────────────────

export const TelegramBotConfigSchema = z.object({
  /** Unique ID for this bot instance */
  botId: z.string().default('default'),
  /** Bot token from BotFather */
  botToken: z.string().min(1, 'Bot token is required'),
  /** The lead agent for this bot — has admin/omnipotent capabilities */
  leadAgentId: z.string().default('lead'),
  /** Per-chat agent mappings: chatId -> agentId */
  agentMappings: z.record(z.string(), z.string()).default({}),
  /** Default agent for unmapped chats (defaults to leadAgentId) */
  defaultAgentId: z.string().optional(),
  /** Bot display name */
  label: z.string().optional(),
  /** Whether this bot is active */
  enabled: z.boolean().default(true),
  /** Chat IDs that are allowed to talk to this bot (empty = all allowed) */
  allowedChatIds: z.array(z.number()).optional(),
  /** Webhook URL registered with Telegram */
  webhookUrl: z.string().optional(),
  /** When the webhook was last set */
  webhookSetAt: z.number().optional(),
});

export type TelegramBotConfig = z.infer<typeof TelegramBotConfigSchema>;

export const TelegramSettingsSchema = z.object({
  /** Multiple bot support — each with its own lead agent + mappings */
  bots: z.array(TelegramBotConfigSchema).default([]),
  /** Legacy single bot token (migrated to bots array) */
  botToken: z.string().optional(),
  /** Legacy lead agent ID */
  leadAgentId: z.string().default('lead'),
  /** Legacy per-chat mappings */
  agentMappings: z.record(z.string(), z.string()).default({}),
  /** Global webhook base URL (used when setting per-bot webhooks) */
  webhookBaseUrl: z.string().optional(),
});

export type TelegramSettings = z.infer<typeof TelegramSettingsSchema>;

// ── Full App Settings ────────────────────────────────────────────

export const AppSettingsSchema = z.object({
  providers: z.record(z.string(), ProviderSettingSchema).default({}),
  /** Custom/user-added providers (marketplace-registered) */
  customProviders: z.record(z.string(), ProviderSettingSchema).default({}),
  integrations: z.record(z.string(), IntegrationSettingSchema).default({}),
  defaultProvider: z.string().default('workers-ai'),
  defaultModel: z.string().default('@cf/meta/llama-3.2-3b-instruct'),
  telegram: TelegramSettingsSchema.default({}),
  /** Default LLM config for chat */
  defaultTemperature: z.number().min(0).max(2).default(0.7),
  defaultMaxTokens: z.number().positive().default(4096),
  /** System-level config */
  sessionSecret: z.string().optional(),
  appName: z.string().default('Multi-Agent Hub'),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

// ── Known built-in providers metadata ─────────────────────────────

export const BUILT_IN_PROVIDERS: Array<{ id: string; label: string; requiresKey: boolean; baseUrl: string; docsUrl?: string }> = [
  { id: 'workers-ai', label: 'Workers AI (Cloudflare)', requiresKey: false, baseUrl: '', docsUrl: 'https://developers.cloudflare.com/workers-ai/' },
  { id: 'openai', label: 'OpenAI', requiresKey: true, baseUrl: 'https://api.openai.com/v1', docsUrl: 'https://platform.openai.com/docs/' },
  { id: 'anthropic', label: 'Anthropic (Claude)', requiresKey: true, baseUrl: 'https://api.anthropic.com/v1', docsUrl: 'https://docs.anthropic.com/' },
  { id: 'google', label: 'Google (Gemini)', requiresKey: true, baseUrl: 'https://generativelanguage.googleapis.com/v1beta', docsUrl: 'https://ai.google.dev/' },
  { id: 'deepseek', label: 'DeepSeek', requiresKey: true, baseUrl: 'https://api.deepseek.com/v1', docsUrl: 'https://platform.deepseek.com/' },
  { id: 'grok', label: 'xAI Grok', requiresKey: true, baseUrl: 'https://api.x.ai/v1', docsUrl: 'https://docs.x.ai/' },
  { id: 'openrouter', label: 'OpenRouter', requiresKey: true, baseUrl: 'https://openrouter.ai/api/v1', docsUrl: 'https://openrouter.ai/docs/' },
];
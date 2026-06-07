import type { ProviderSetting } from '@midas/contracts';
import type { AIProvider, ProviderConfig } from './types.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { GoogleProvider } from './google-provider.js';
import { DeepSeekProvider } from './deepseek-provider.js';
import { GrokProvider } from './grok-provider.js';
import { OpenRouterProvider } from './openrouter-provider.js';
import { WorkersAIProvider, WORKERS_AI_MODELS } from './workers-ai-provider.js';
import { GOOGLE_MODELS } from './google-provider.js';
import { DEEPSEEK_MODELS } from './deepseek-provider.js';
import { GROK_MODELS } from './grok-provider.js';

export interface ProviderFactory {
  create(config: ProviderConfig, ai?: Ai): AIProvider;
}

type ProviderConstructor = new (config: ProviderConfig, ai?: Ai) => AIProvider;

/** Built-in provider constructors */
const registry: Record<string, ProviderConstructor> = {
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  google: GoogleProvider,
  deepseek: DeepSeekProvider,
  grok: GrokProvider,
  openrouter: OpenRouterProvider,
  'workers-ai': WorkersAIProvider as unknown as ProviderConstructor,
};

/** Default models for each provider when none is configured */
export const DEFAULT_MODELS: Record<string, string[]> = {
  'workers-ai': WORKERS_AI_MODELS,
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
  google: GOOGLE_MODELS,
  deepseek: DEEPSEEK_MODELS,
  grok: GROK_MODELS,
  openrouter: [
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'anthropic/claude-sonnet-4',
    'anthropic/claude-3.5-haiku',
    'google/gemini-2.0-flash',
    'deepseek/deepseek-chat',
    'meta-llama/llama-3.1-8b-instruct',
  ],
};

/** Check if a provider is registered (built-in) */
export function isProviderRegistered(name: string): boolean {
  return name in registry;
}

/**
 * Create a provider instance from settings.
 * Handles both built-in and custom (OpenAI-compatible) providers.
 */
export function createProviderFromSettings(
  settings: ProviderSetting,
  ai?: Ai,
): AIProvider {
  // Built-in provider
  if (registry[settings.provider]) {
    const Constructor = registry[settings.provider];
    const config: ProviderConfig = {
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.defaultModel || undefined,
    };
    return new Constructor(config, ai);
  }

  // Custom provider — use OpenAI-compatible client
  const config: ProviderConfig = {
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl || 'https://api.openai.com/v1',
    model: settings.defaultModel || undefined,
  };
  return new OpenAIProvider(config, ai);
}

/** Get all registered (built-in) provider names */
export function getRegisteredProviders(): string[] {
  return Object.keys(registry);
}

/** Fetch available models for OpenAI-compatible providers */
export async function fetchProviderModels(
  providerName: string,
  apiKey: string,
  baseUrl?: string,
): Promise<string[]> {
  let url: string;

  switch (providerName) {
    case 'openrouter':
      url = `${baseUrl || 'https://openrouter.ai/api'}/v1/models`;
      break;
    case 'deepseek':
      url = `${baseUrl || 'https://api.deepseek.com'}/v1/models`;
      break;
    default:
      url = `${baseUrl || 'https://api.openai.com'}/v1/models`;
  }

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    return (data?.data ?? [])
      .map((m: any) => m.id)
      .filter(Boolean)
      .sort();
  } catch {
    return [];
  }
}

export { WorkersAIProvider, WORKERS_AI_MODELS };
export { GoogleProvider, GOOGLE_MODELS };
export { DeepSeekProvider, DEEPSEEK_MODELS };
export { GrokProvider, GROK_MODELS };
export { OpenRouterProvider };
export { OpenAIProvider } from './openai-provider.js';
export { AnthropicProvider } from './anthropic-provider.js';
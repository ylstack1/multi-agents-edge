import type { AIProvider } from './types.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';

interface ProviderConfig {
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

/**
 * Factory for creating AI providers based on configuration.
 * Supports OpenAI and Anthropic.
 */
export function createProvider(config: ProviderConfig, preferredProvider?: string): AIProvider {
  if (preferredProvider === 'anthropic' && config.anthropicApiKey) {
    return new AnthropicProvider(config.anthropicApiKey);
  }

  if (preferredProvider === 'openai' && config.openaiApiKey) {
    return new OpenAIProvider(config.openaiApiKey);
  }

  // Auto-detect based on available keys
  if (config.openaiApiKey) {
    return new OpenAIProvider(config.openaiApiKey);
  }

  if (config.anthropicApiKey) {
    return new AnthropicProvider(config.anthropicApiKey);
  }

  throw new Error(
    'No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in environment.',
  );
}
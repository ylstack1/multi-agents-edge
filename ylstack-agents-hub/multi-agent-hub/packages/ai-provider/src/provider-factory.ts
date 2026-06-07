import type { AIProvider } from './types.js';
import { createProviderFromSettings } from './provider-registry.js';

interface ProviderConfig {
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

/**
 * Legacy provider factory — kept for backward compatibility.
 * Auto-detects best available provider from environment config.
 * Falls back to Workers AI (no key needed).
 */
export function createProvider(config: ProviderConfig, preferredProvider?: string): AIProvider {
  if (preferredProvider) {
    const key =
      preferredProvider === 'openai'
        ? config.openaiApiKey
        : preferredProvider === 'anthropic'
          ? config.anthropicApiKey
          : undefined;
    return createProviderFromSettings({
      provider: preferredProvider as any,
      enabled: true,
      apiKey: key,
    });
  }

  if (config.openaiApiKey) {
    return createProviderFromSettings({ provider: 'openai', enabled: true, apiKey: config.openaiApiKey });
  }
  if (config.anthropicApiKey) {
    return createProviderFromSettings({ provider: 'anthropic', enabled: true, apiKey: config.anthropicApiKey });
  }

  // Default: Workers AI — requires no API key
  return createProviderFromSettings({ provider: 'workers-ai', enabled: true });
}
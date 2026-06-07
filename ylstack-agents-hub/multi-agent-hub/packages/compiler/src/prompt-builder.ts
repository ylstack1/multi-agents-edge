import type { CompiledPrompt, LLMMessage, LLMConfig } from '@midas/contracts';
import { concatenateWorkspace, type ConcatenationResult } from './file-concatenator.js';
import { estimateTokens } from './token-estimator.js';
import type { AgentWorkspace } from '@midas/contracts';

export interface PromptBuildOptions {
  workspace: AgentWorkspace;
  userMessage: string;
  config?: Partial<LLMConfig>;
  conversationHistory?: LLMMessage[];
}

export interface PromptBuilderResult {
  compiled: CompiledPrompt;
  concatenation: ConcatenationResult;
}

/**
 * Builds the final LLM request payload from a workspace and user message.
 */
export function buildPrompt(opts: PromptBuildOptions): PromptBuilderResult {
  const concatenation = concatenateWorkspace(opts.workspace);
  const systemPrompt = concatenation.systemPrompt;

  const tokenEstimate = estimateTokens(systemPrompt, opts.config?.maxTokens ?? 128_000);

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(opts.conversationHistory ?? []),
    { role: 'user', content: opts.userMessage },
  ];

  return {
    compiled: {
      systemPrompt,
      messages,
      estimatedTokens: tokenEstimate.estimatedTokens,
      sourceFiles: concatenation.includedFiles,
    },
    concatenation,
  };
}

/**
 * Convert workspace tools.md content into LLM tool definitions.
 */
export function extractToolDefinitions(
  toolsMdContent: string | null,
): CompiledPrompt['toolDefinitions'] {
  if (!toolsMdContent) return undefined;

  try {
    // Try to parse tools.md as JSON tool definitions
    const parsed = JSON.parse(toolsMdContent);
    if (Array.isArray(parsed)) {
      return parsed.map((t: Record<string, unknown>) => ({
        name: String(t.name ?? 'unknown'),
        description: String(t.description ?? ''),
        inputSchema: (t.inputSchema ?? t.parameters ?? {}) as Record<string, unknown>,
      }));
    }
  } catch {
    // If not JSON, return undefined — tools.md may be plain text docs
  }

  return undefined;
}
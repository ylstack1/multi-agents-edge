import type { CompiledPrompt } from '@midas/contracts';

export interface CompilerOptions {
  systemPrompt: string;
  messages: CompiledPrompt['messages'];
  toolDefinitions?: CompiledPrompt['toolDefinitions'];
  sourceFiles: string[];
}

export const DEFAULT_CONCATENATION_ORDER = [
  'soul.md',
  'identity.md',
  'user.md',
  'memory.md',
  'tools.md',
] as const;

export const CANONICAL_FILE_HEADERS: Record<(typeof DEFAULT_CONCATENATION_ORDER)[number], string> = {
  'soul.md': '=== SOUL === Core Values & Tone',
  'identity.md': '=== IDENTITY === Role & Metadata',
  'user.md': '=== USER === Human Operator Context',
  'memory.md': '=== MEMORY === Episodic Log',
  'tools.md': '=== TOOLS === MCP Capabilities',
};
import { MARKDOWN_FILE_NAMES, type AgentWorkspace } from '@midas/contracts';
import { CANONICAL_FILE_HEADERS, DEFAULT_CONCATENATION_ORDER } from './types.js';

export interface ConcatenationResult {
  /** The full compiled system prompt string */
  systemPrompt: string;
  /** Ordered list of files that were successfully included */
  includedFiles: string[];
  /** Ordered list of files that were missing (null content) */
  missingFiles: string[];
}

/**
 * Sequentially stitch workspace markdown files into a single system prompt.
 * Files are ordered: soul -> identity -> user -> memory -> tools.
 * Missing/null files are silently skipped.
 */
export function concatenateWorkspace(workspace: AgentWorkspace): ConcatenationResult {
  const segments: string[] = [];
  const includedFiles: string[] = [];
  const missingFiles: string[] = [];

  for (const fileName of DEFAULT_CONCATENATION_ORDER) {
    const content = workspace.files[fileName];
    const header = CANONICAL_FILE_HEADERS[fileName];

    if (content === null || content === undefined) {
      missingFiles.push(fileName);
      continue;
    }

    includedFiles.push(fileName);
    segments.push(header);
    segments.push('');
    segments.push(content.trim());
    segments.push('');
    segments.push('');
  }

  return {
    systemPrompt: segments.join('\n').trim(),
    includedFiles,
    missingFiles,
  };
}

/**
 * Concatenate a subset of files (useful for Sub-agents that may not have all files).
 */
export function concatenatePartial(
  files: Partial<Record<(typeof MARKDOWN_FILE_NAMES)[number], string | null>>,
): ConcatenationResult {
  const workspace: AgentWorkspace = {
    agentId: 'partial',
    files: {
      'soul.md': files['soul.md'] ?? null,
      'identity.md': files['identity.md'] ?? null,
      'user.md': files['user.md'] ?? null,
      'memory.md': files['memory.md'] ?? null,
      'tools.md': files['tools.md'] ?? null,
    },
    lastModifiedEpochMs: Date.now(),
  };
  return concatenateWorkspace(workspace);
}
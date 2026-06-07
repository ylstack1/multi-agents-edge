const TOKEN_ESTIMATE_RATIO = 0.25; // ~4 chars per token for English text
const SAFETY_MARGIN = 1.1; // 10% overestimation to be safe

export interface TokenEstimate {
  estimatedTokens: number;
  characterCount: number;
  isOverLimit: boolean;
  limit: number;
}

/**
 * Heuristic token estimator using character-count approximation.
 * No external deps — safe for V8 isolates.
 */
export function estimateTokens(text: string, limit: number = 128_000): TokenEstimate {
  const characterCount = text.length;
  const estimatedTokens = Math.ceil(characterCount * TOKEN_ESTIMATE_RATIO * SAFETY_MARGIN);
  return {
    estimatedTokens,
    characterCount,
    isOverLimit: estimatedTokens > limit,
    limit,
  };
}

/**
 * Truncate a string to fit within an estimated token budget.
 * Preserves the beginning and end of the content with a truncation notice.
 */
export function truncateToTokenBudget(
  text: string,
  budget: number,
): { truncated: boolean; content: string } {
  const estimate = estimateTokens(text, budget);
  if (!estimate.isOverLimit) {
    return { truncated: false, content: text };
  }

  // Rough: budget tokens ~ budget/ratio characters, minus safety
  const targetChars = Math.floor((budget / TOKEN_ESTIMATE_RATIO / SAFETY_MARGIN) * 0.7);
  const halfChars = Math.floor(targetChars / 2);

  if (halfChars < 50) {
    // Budget too small, return empty with notice
    return {
      truncated: true,
      content: '[MEMORY TRUNCATED: token budget exceeded minimum threshold]',
    };
  }

  const start = text.slice(0, halfChars);
  const end = text.slice(-halfChars);
  const truncationNotice = `\n\n[... MEMORY TRUNCATED: ${estimate.estimatedTokens} estimated tokens exceeds budget of ${budget} ...]\n\n`;

  return {
    truncated: true,
    content: `${start}${truncationNotice}${end}`,
  };
}
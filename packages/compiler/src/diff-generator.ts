import type { WorkspaceDiffEntry } from '@midas/contracts';

export interface DiffInput {
  oldLines: string[];
  newLines: string[];
}

/**
 * Pure function producing a Git-style line-by-line diff.
 * Uses a simple LCS (Longest Common Subsequence) approach.
 * Returns an array of DiffEntry objects.
 */
export function generateDiff(oldText: string, newText: string): WorkspaceDiffEntry[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const entries: WorkspaceDiffEntry[] = [];

  // Simple line-by-line diff using LCS
  const lcs = longestCommonSubsequence(oldLines, newLines);
  let oldIdx = 0;
  let newIdx = 0;
  let lineNumber = 1;

  for (const commonLine of lcs) {
    // Output removed lines from old
    while (oldIdx < oldLines.length && oldLines[oldIdx] !== commonLine) {
      entries.push({
        type: 'removed',
        line: oldLines[oldIdx] ?? '',
        lineNumber: lineNumber++,
      });
      oldIdx++;
    }
    // Output added lines from new
    while (newIdx < newLines.length && newLines[newIdx] !== commonLine) {
      entries.push({
        type: 'added',
        line: newLines[newIdx] ?? '',
        lineNumber: lineNumber++,
      });
      newIdx++;
    }
    // Output unchanged line
    if (oldIdx < oldLines.length && newIdx < newLines.length) {
      entries.push({
        type: 'unchanged',
        line: commonLine,
        lineNumber: lineNumber++,
      });
      oldIdx++;
      newIdx++;
    }
  }

  // Remaining old lines (removed)
  while (oldIdx < oldLines.length) {
    entries.push({
      type: 'removed',
      line: oldLines[oldIdx] ?? '',
      lineNumber: lineNumber++,
    });
    oldIdx++;
  }

  // Remaining new lines (added)
  while (newIdx < newLines.length) {
    entries.push({
      type: 'added',
      line: newLines[newIdx] ?? '',
      lineNumber: lineNumber++,
    });
    newIdx++;
  }

  return entries;
}

/**
 * Simple LCS algorithm that returns the actual common subsequence array.
 */
function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    const row = dp[i] as number[];
    const prevRow = dp[i - 1] as number[];
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        row[j] = prevRow[j - 1] + 1;
      } else {
        row[j] = Math.max(prevRow[j], row[j - 1]);
      }
    }
  }

  // Backtrack to find the sequence
  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1] as string);
      i--;
      j--;
    } else if ((dp[i - 1] as number[])[j] > (dp[i] as number[])[j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * Apply reasoning strings to diff entries.
 */
export function annotateDiff(
  entries: WorkspaceDiffEntry[],
  reasoning: string,
): WorkspaceDiffEntry[] {
  return entries.map((entry) => ({
    ...entry,
    reasoning: entry.type !== 'unchanged' ? reasoning : undefined,
  }));
}
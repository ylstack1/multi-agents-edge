import { describe, it, expect } from 'vitest';
import { generateDiff, annotateDiff } from '../src/diff-generator.js';
import type { WorkspaceDiffEntry } from '@midas/contracts';

describe('generateDiff', () => {
  it('returns empty diff for identical strings', () => {
    const result = generateDiff('hello\nworld', 'hello\nworld');
    expect(result.every((e) => e.type === 'unchanged')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('detects added lines', () => {
    const result = generateDiff('line1', 'line1\nline2\nline3');
    const added = result.filter((e) => e.type === 'added');
    expect(added).toHaveLength(2);
    expect(added[0]?.line).toBe('line2');
    expect(added[1]?.line).toBe('line3');
  });

  it('detects removed lines', () => {
    const result = generateDiff('line1\nline2\nline3', 'line1');
    const removed = result.filter((e) => e.type === 'removed');
    expect(removed.length).toBeGreaterThanOrEqual(2);
  });

  it('handles empty old text (new file)', () => {
    const result = generateDiff('', 'line1\nline2');
    const added = result.filter((e) => e.type === 'added');
    expect(added).toHaveLength(2);
  });

  it('handles empty new text (deleted file)', () => {
    const result = generateDiff('line1\nline2', '');
    const removed = result.filter((e) => e.type === 'removed');
    expect(removed).toHaveLength(2);
  });

  it('handles single-line strings', () => {
    const result = generateDiff('old', 'new');
    expect(result).toHaveLength(2);
    expect(result[0]?.type).toBe('removed');
    expect(result[1]?.type).toBe('added');
  });
});

describe('annotateDiff', () => {
  it('adds reasoning to added and removed entries', () => {
    const diff: WorkspaceDiffEntry[] = [
      { type: 'unchanged', line: 'same', lineNumber: 1 },
      { type: 'added', line: 'new line', lineNumber: 2 },
      { type: 'removed', line: 'old line', lineNumber: 3 },
    ];
    const annotated = annotateDiff(diff, 'Updated based on user feedback');
    expect(annotated[0]?.reasoning).toBeUndefined();
    expect(annotated[1]?.reasoning).toBe('Updated based on user feedback');
    expect(annotated[2]?.reasoning).toBe('Updated based on user feedback');
  });
});
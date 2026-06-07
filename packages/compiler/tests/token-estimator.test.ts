import { describe, it, expect } from 'vitest';
import { estimateTokens, truncateToTokenBudget } from '../src/token-estimator.js';

describe('estimateTokens', () => {
  it('returns 0 tokens for empty string', () => {
    const result = estimateTokens('');
    expect(result.estimatedTokens).toBe(0);
    expect(result.characterCount).toBe(0);
    expect(result.isOverLimit).toBe(false);
  });

  it('estimates tokens for short text', () => {
    const result = estimateTokens('Hello world');
    expect(result.estimatedTokens).toBeGreaterThan(0);
    expect(result.characterCount).toBe(11);
  });

  it('detects overflow for very long text', () => {
    const longText = 'a'.repeat(1_000_000);
    const result = estimateTokens(longText, 1000);
    expect(result.isOverLimit).toBe(true);
  });

  it('does not trigger overflow for short text with large limit', () => {
    const result = estimateTokens('Short text', 128_000);
    expect(result.isOverLimit).toBe(false);
  });
});

describe('truncateToTokenBudget', () => {
  it('does not truncate when under budget', () => {
    const result = truncateToTokenBudget('Short text', 1000);
    expect(result.truncated).toBe(false);
    expect(result.content).toBe('Short text');
  });

  it('truncates very long text', () => {
    const longText = 'Hello world. '.repeat(5000);
    const result = truncateToTokenBudget(longText, 100);
    expect(result.truncated).toBe(true);
    expect(result.content.length).toBeLessThan(longText.length);
    expect(result.content).toContain('MEMORY TRUNCATED');
  });

  it('returns notice when budget is too small', () => {
    const result = truncateToTokenBudget('Some text here', 1);
    expect(result.truncated).toBe(true);
    expect(result.content).toContain('token budget exceeded minimum threshold');
  });
});
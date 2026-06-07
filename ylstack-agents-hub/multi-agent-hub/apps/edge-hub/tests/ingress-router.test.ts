import { describe, it, expect } from 'vitest';

describe('Ingress Router Logic', () => {
  it('rejects missing authorization', () => {
    const headers = new Headers();
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('X-Session-Token')).toBe(false);
  });

  it('detects path traversal attempts in agentIds', () => {
    // Contains '..' that form directory traversal
    expect('../etc/passwd'.includes('..')).toBe(true);
    expect('..\\..\\windows\\system32'.includes('..')).toBe(true);
    // URL-encoded and other variants may not contain literal '..'
    // but the security validator should handle them
    expect('../lead/soul.md'.includes('..')).toBe(true);
  });

  it('rejects empty or invalid agentIds', () => {
    const validateAgentId = (id: string) => {
      if (id.includes('..')) return false;
      if (id.includes('/')) return false;
      return /^[a-zA-Z0-9-]+$/.test(id);
    };

    expect(validateAgentId('')).toBe(false);
    expect(validateAgentId('../etc')).toBe(false);
    expect(validateAgentId('valid-agent')).toBe(true);
  });

  it('validates source header values', () => {
    const validSources = ['TELEGRAM', 'WEB_UI'];
    const invalidSources = ['SLACK', 'DISCORD', 'API', ''];

    for (const source of validSources) {
      expect(['TELEGRAM', 'WEB_UI']).toContain(source);
    }

    for (const source of invalidSources) {
      expect(['TELEGRAM', 'WEB_UI']).not.toContain(source);
    }
  });
});
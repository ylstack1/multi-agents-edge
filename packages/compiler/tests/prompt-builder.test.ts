import { describe, it, expect } from 'vitest';
import { buildPrompt, extractToolDefinitions } from '../src/prompt-builder.js';
import type { AgentWorkspace } from '@midas/contracts';

const mockWorkspace: AgentWorkspace = {
  agentId: 'test',
  files: {
    'soul.md': '# Soul\n\nBe helpful and concise.',
    'identity.md': '# Identity\n\nName: TestAgent',
    'user.md': '# User\n\nAdmin user',
    'memory.md': '# Memory\n\nPrevious context.',
    'tools.md': '# Tools\n\n- search_web: Search the web',
  },
  lastModifiedEpochMs: Date.now(),
};

describe('buildPrompt', () => {
  it('builds a valid compiled prompt', () => {
    const result = buildPrompt({
      workspace: mockWorkspace,
      userMessage: 'Hello agent!',
    });

    expect(result.compiled.systemPrompt.length).toBeGreaterThan(0);
    expect(result.compiled.systemPrompt).toContain('=== SOUL ===');
    expect(result.compiled.messages).toHaveLength(2); // system + user
    expect(result.compiled.messages[0]?.role).toBe('system');
    expect(result.compiled.messages[1]?.role).toBe('user');
    expect(result.compiled.messages[1]?.content).toBe('Hello agent!');
    expect(result.compiled.estimatedTokens).toBeGreaterThan(0);
    expect(result.compiled.sourceFiles).toContain('soul.md');
  });

  it('includes conversation history when provided', () => {
    const result = buildPrompt({
      workspace: mockWorkspace,
      userMessage: 'Second message',
      conversationHistory: [{ role: 'assistant', content: 'First response' }],
    });

    expect(result.compiled.messages).toHaveLength(3); // system + history + user
    expect(result.compiled.messages[1]?.role).toBe('assistant');
    expect(result.compiled.messages[1]?.content).toBe('First response');
  });

  it('reports which source files were included', () => {
    const result = buildPrompt({
      workspace: mockWorkspace,
      userMessage: 'Hi',
    });
    expect(result.compiled.sourceFiles).toEqual(
      expect.arrayContaining(['soul.md', 'identity.md', 'user.md', 'memory.md', 'tools.md']),
    );
  });

  it('reports missing files', () => {
    const ws: AgentWorkspace = {
      ...mockWorkspace,
      files: {
        'soul.md': '# Soul only',
        'identity.md': null,
        'user.md': null,
        'memory.md': null,
        'tools.md': null,
      },
    };
    const result = buildPrompt({ workspace: ws, userMessage: 'Hi' });
    expect(result.concatenation.missingFiles).toEqual(
      expect.arrayContaining(['identity.md', 'user.md', 'memory.md', 'tools.md']),
    );
  });
});

describe('extractToolDefinitions', () => {
  it('parses JSON tools.md content', () => {
    const toolsMd = JSON.stringify([
      { name: 'search', description: 'Search web', inputSchema: { type: 'object' } },
    ]);
    const result = extractToolDefinitions(toolsMd);
    expect(result).toHaveLength(1);
    expect(result![0]?.name).toBe('search');
  });

  it('returns undefined for null content', () => {
    const result = extractToolDefinitions(null);
    expect(result).toBeUndefined();
  });

  it('returns undefined for invalid JSON (treats as plain text)', () => {
    const result = extractToolDefinitions('# Tools\n\nJust documentation');
    expect(result).toBeUndefined();
  });
});
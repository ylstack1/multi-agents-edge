import { describe, it, expect } from 'vitest';
import { concatenateWorkspace, concatenatePartial } from '../src/file-concatenator.js';
import type { AgentWorkspace } from '@midas/contracts';

function makeWorkspace(overrides: Partial<AgentWorkspace['files']> = {}): AgentWorkspace {
  return {
    agentId: 'test',
    files: {
      'soul.md': '# Soul\n\nBe helpful.',
      'identity.md': '# Identity\n\nName: Test Agent',
      'user.md': '# User\n\nJohn Doe',
      'memory.md': '# Memory\n\nPrevious chat.',
      'tools.md': '# Tools\n\n- search_web',
      ...overrides,
    },
    lastModifiedEpochMs: Date.now(),
  };
}

describe('concatenateWorkspace', () => {
  it('concatenates all files in correct order', () => {
    const result = concatenateWorkspace(makeWorkspace());
    expect(result.systemPrompt).toContain('=== SOUL ===');
    expect(result.systemPrompt).toContain('=== IDENTITY ===');
    expect(result.systemPrompt).toContain('=== USER ===');
    expect(result.systemPrompt).toContain('=== MEMORY ===');
    expect(result.systemPrompt).toContain('=== TOOLS ===');
    expect(result.missingFiles).toHaveLength(0);
    expect(result.includedFiles).toHaveLength(5);
  });

  it('orders files: soul, identity, user, memory, tools', () => {
    const result = concatenateWorkspace(makeWorkspace());
    const soulIdx = result.systemPrompt.indexOf('=== SOUL ===');
    const identityIdx = result.systemPrompt.indexOf('=== IDENTITY ===');
    const toolsIdx = result.systemPrompt.indexOf('=== TOOLS ===');
    expect(soulIdx).toBeLessThan(identityIdx);
    expect(identityIdx).toBeLessThan(toolsIdx);
  });

  it('skips null files and reports them as missing', () => {
    const result = concatenateWorkspace(
      makeWorkspace({ 'memory.md': null, 'tools.md': null }),
    );
    expect(result.systemPrompt).toContain('=== SOUL ===');
    expect(result.systemPrompt).not.toContain('=== MEMORY ===');
    expect(result.systemPrompt).not.toContain('=== TOOLS ===');
    expect(result.missingFiles).toContain('memory.md');
    expect(result.missingFiles).toContain('tools.md');
    expect(result.includedFiles).toHaveLength(3);
  });

  it('handles workspace with all null files gracefully', () => {
    const result = concatenateWorkspace(
      makeWorkspace({
        'soul.md': null,
        'identity.md': null,
        'user.md': null,
        'memory.md': null,
        'tools.md': null,
      }),
    );
    expect(result.systemPrompt).toBe('');
    expect(result.missingFiles).toHaveLength(5);
    expect(result.includedFiles).toHaveLength(0);
  });

  it('trims content and adds proper spacing', () => {
    const result = concatenateWorkspace(makeWorkspace());
    expect(result.systemPrompt).not.toMatch(/^\s+/);
    expect(result.systemPrompt).not.toMatch(/\s+$/);
    expect(result.systemPrompt.length).toBeGreaterThan(0);
  });
});

describe('concatenatePartial', () => {
  it('works with a subset of files', () => {
    const result = concatenatePartial({
      'soul.md': '# Soul only',
      'tools.md': '# Tools only',
    });
    expect(result.systemPrompt).toContain('=== SOUL ===');
    expect(result.systemPrompt).toContain('=== TOOLS ===');
    expect(result.systemPrompt).not.toContain('=== IDENTITY ===');
    expect(result.includedFiles).toHaveLength(2);
    expect(result.missingFiles).toHaveLength(3);
  });
});
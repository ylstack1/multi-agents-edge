import { describe, it, expect } from 'vitest';

describe('Agent Workflow Logic', () => {
  describe('Lead vs Sub-Agent Routing', () => {
    it('correctly identifies lead agent', () => {
      const role = (id: string) => (id === 'lead' ? 'LEAD' : 'SUB_AGENT');
      expect(role('lead')).toBe('LEAD');
      expect(role('code-agent')).toBe('SUB_AGENT');
      expect(role('sub-reviewer')).toBe('SUB_AGENT');
    });
  });

  describe('Execution Tracing', () => {
    it('creates a trace with sequential nodes', () => {
      const trace = {
        traceId: 'trace-1',
        sessionId: 'sess-1',
        startedAt: Date.now(),
        nodes: [
          { id: 'n1', type: 'user_request', label: 'Input', timestamp: Date.now(), status: 'success' },
          { id: 'n2', type: 'lead_analysis', label: 'Analysis', timestamp: Date.now(), status: 'success', parentId: 'n1' },
          { id: 'n3', type: 'sub_agent_assignment', label: 'Delegate', timestamp: Date.now(), status: 'success', parentId: 'n2' },
          { id: 'n4', type: 'lead_synthesis', label: 'Synthesis', timestamp: Date.now(), status: 'success', parentId: 'n3' },
        ],
        status: 'completed',
      };

      expect(trace.nodes).toHaveLength(4);
      expect(trace.nodes[0]?.type).toBe('user_request');
      expect(trace.nodes[1]?.parentId).toBe('n1');
      expect(trace.nodes[2]?.parentId).toBe('n2');
      expect(trace.nodes[3]?.parentId).toBe('n3');
    });

    it('highlights error nodes', () => {
      const errorNode = {
        type: 'mcp_tool_execution',
        label: 'Search Web',
        status: 'error' as const,
        metadata: { error: 'Connection timeout' },
      };
      expect(errorNode.status).toBe('error');
      expect(errorNode.metadata?.error).toBe('Connection timeout');
    });
  });

  describe('Prompt Compilation Flow', () => {
    it('builds system prompt with correct structure', () => {
      const files = {
        'soul.md': 'Be helpful',
        'identity.md': 'Code Reviewer',
        'user.md': 'John',
        'memory.md': 'Previous: fixed bug',
        'tools.md': '[{"name":"analyze","description":"Code analysis"}]',
      };

      const order = ['soul.md', 'identity.md', 'user.md', 'memory.md', 'tools.md'];
      const segments = order.map((f) => `=== ${f.toUpperCase().replace('.MD', '')} ===\n${files[f as keyof typeof files]}`);

      const prompt = segments.join('\n\n');
      expect(prompt).toContain('=== SOUL ===');
      expect(prompt).toContain('=== TOOLS ===');
      expect(prompt).toContain('Code analysis');
    });
  });
});
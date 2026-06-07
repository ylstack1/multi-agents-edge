import { describe, it, expect } from 'vitest';
import {
  AgentWorkspaceSchema,
  IngressPayloadSchema,
  ModifySubAgentPayloadSchema,
  LLMMessageSchema,
  MCPEndpointSchema,
  MCPToolSchema,
  ExecutionTraceSchema,
} from '../src/index.js';
import { isValidMarkdownFileName } from '../src/identifiers.js';

describe('isValidMarkdownFileName', () => {
  it('accepts valid markdown file names', () => {
    expect(isValidMarkdownFileName('soul.md')).toBe(true);
    expect(isValidMarkdownFileName('identity.md')).toBe(true);
    expect(isValidMarkdownFileName('user.md')).toBe(true);
    expect(isValidMarkdownFileName('memory.md')).toBe(true);
    expect(isValidMarkdownFileName('tools.md')).toBe(true);
  });

  it('rejects invalid file names', () => {
    expect(isValidMarkdownFileName('config.json')).toBe(false);
    expect(isValidMarkdownFileName('../soul.md')).toBe(false);
    expect(isValidMarkdownFileName('passwd')).toBe(false);
    expect(isValidMarkdownFileName('soul.txt')).toBe(false);
    expect(isValidMarkdownFileName('')).toBe(false);
  });
});

describe('AgentWorkspaceSchema', () => {
  it('validates a complete workspace', () => {
    const result = AgentWorkspaceSchema.safeParse({
      agentId: 'lead',
      files: {
        'soul.md': 'Be helpful',
        'identity.md': 'I am an agent',
        'user.md': 'User info',
        'memory.md': 'Previous conversation',
        'tools.md': null,
      },
      lastModifiedEpochMs: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects workspace with invalid file key', () => {
    const result = AgentWorkspaceSchema.safeParse({
      agentId: 'test',
      files: {
        'config.json': 'invalid',
      },
      lastModifiedEpochMs: Date.now(),
    });
    // Zod strict object should reject unknown keys
    expect(result.success).toBe(false);
  });

  it('rejects workspace with missing agentId', () => {
    const result = AgentWorkspaceSchema.safeParse({
      files: {},
      lastModifiedEpochMs: Date.now(),
    });
    expect(result.success).toBe(false);
  });
});

describe('IngressPayloadSchema', () => {
  it('validates a valid ingress payload', () => {
    const result = IngressPayloadSchema.safeParse({
      sessionId: 'sess-123',
      source: 'WEB_UI',
      targetAgentId: 'lead',
      content: 'Hello agent',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid source value', () => {
    const result = IngressPayloadSchema.safeParse({
      sessionId: 'sess-123',
      source: 'INVALID',
      targetAgentId: 'lead',
      content: 'Hello',
    });
    expect(result.success).toBe(false);
  });
});

describe('ModifySubAgentPayloadSchema', () => {
  it('validates a valid modification payload', () => {
    const result = ModifySubAgentPayloadSchema.safeParse({
      targetAgentId: 'code-agent',
      fileToModify: 'soul.md',
      newContent: '# Updated soul',
      reasoning: 'Making the agent stricter',
    });
    expect(result.success).toBe(true);
  });

  it('rejects payload with missing reasoning', () => {
    const result = ModifySubAgentPayloadSchema.safeParse({
      targetAgentId: 'code-agent',
      fileToModify: 'soul.md',
      newContent: '# Updated soul',
    });
    expect(result.success).toBe(false);
  });

  it('rejects payload with invalid file name', () => {
    const result = ModifySubAgentPayloadSchema.safeParse({
      targetAgentId: 'code-agent',
      fileToModify: 'config.json',
      newContent: '{}',
      reasoning: 'Testing',
    });
    expect(result.success).toBe(false);
  });
});

describe('LLMMessageSchema', () => {
  it('validates a system message', () => {
    const result = LLMMessageSchema.safeParse({
      role: 'system',
      content: 'You are a helpful assistant.',
    });
    expect(result.success).toBe(true);
  });

  it('validates a message with tool calls', () => {
    const result = LLMMessageSchema.safeParse({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'search', arguments: '{"query":"test"}' },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('MCPEndpointSchema', () => {
  it('validates a valid MCP endpoint', () => {
    const result = MCPEndpointSchema.safeParse({
      id: 'mcp-1',
      name: 'Web Search',
      url: 'https://mcp.example.com/sse',
      transport: 'sse',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid URL', () => {
    const result = MCPEndpointSchema.safeParse({
      id: 'mcp-1',
      name: 'Bad',
      url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

describe('ExecutionTraceSchema', () => {
  it('validates a trace with nodes', () => {
    const result = ExecutionTraceSchema.safeParse({
      traceId: 'trace-1',
      sessionId: 'sess-1',
      startedAt: Date.now(),
      nodes: [
        {
          id: 'node-1',
          type: 'user_request',
          label: 'User Request',
          timestamp: Date.now(),
          status: 'success',
        },
      ],
      status: 'running',
    });
    expect(result.success).toBe(true);
  });
});
import { describe, it, expect } from 'vitest';
import { toOpenAIFormat, toAnthropicFormat, discoverTools } from '../src/schema-translator.js';

const mockTools = [
  {
    name: 'search_web',
    description: 'Search the web',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'calculate',
    description: 'Do math',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string' },
      },
    },
  },
];

describe('toOpenAIFormat', () => {
  it('converts MCP tools to OpenAI format', () => {
    const result = toOpenAIFormat(mockTools);
    expect(result).toHaveLength(2);
    expect(result[0]?.type).toBe('function');
    expect(result[0]?.function.name).toBe('search_web');
    expect(result[0]?.function.parameters).toHaveProperty('type', 'object');
  });

  it('includes description in output', () => {
    const result = toOpenAIFormat(mockTools);
    expect(result[0]?.function.description).toBe('Search the web');
  });

  it('handles empty tool array', () => {
    const result = toOpenAIFormat([]);
    expect(result).toHaveLength(0);
  });
});

describe('toAnthropicFormat', () => {
  it('converts MCP tools to Anthropic format', () => {
    const result = toAnthropicFormat(mockTools);
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('search_web');
    expect(result[0]?.input_schema).toHaveProperty('type', 'object');
  });
});

describe('discoverTools', () => {
  it('extracts tools from discovery response', () => {
    const result = discoverTools({
      tools: mockTools,
    });
    expect(result).toHaveLength(2);
  });

  it('extracts tools from result field', () => {
    const result = discoverTools({
      result: mockTools,
    });
    expect(result).toHaveLength(2);
  });

  it('returns empty array for unrecognized format', () => {
    const result = discoverTools({ unexpected: 'data' });
    expect(result).toHaveLength(0);
  });

  it('handles empty discovery', () => {
    const result = discoverTools({});
    expect(result).toHaveLength(0);
  });
});
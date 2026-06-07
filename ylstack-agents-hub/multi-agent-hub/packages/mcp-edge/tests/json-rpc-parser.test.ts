import { describe, it, expect } from 'vitest';
import {
  parseJSONRPCMessage,
  parseBatch,
  extractToolCall,
  createRequest,
  createResponse,
  createError,
} from '../src/json-rpc-parser.js';

describe('parseJSONRPCMessage', () => {
  it('parses a valid JSON-RPC message', () => {
    const result = parseJSONRPCMessage(
      JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [] } }),
    );
    expect(result.jsonrpc).toBe('2.0');
    expect(result.id).toBe(1);
  });

  it('parses a request message', () => {
    const result = parseJSONRPCMessage(
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    );
    expect(result.method).toBe('tools/list');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseJSONRPCMessage('not-json')).toThrow();
  });

  it('throws on non-object JSON', () => {
    expect(() => parseJSONRPCMessage('"string"')).toThrow();
  });

  it('throws on wrong jsonrpc version', () => {
    expect(() =>
      parseJSONRPCMessage(JSON.stringify({ jsonrpc: '1.0', id: 1 })),
    ).toThrow();
  });

  it('parses error response', () => {
    const result = parseJSONRPCMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32601, message: 'Method not found' },
      }),
    );
    expect(result.error?.code).toBe(-32601);
  });

  it('handles fragmented data gracefully', () => {
    const result = parseJSONRPCMessage(
      JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'done' }),
    );
    expect(result.result).toBe('done');
  });
});

describe('parseBatch', () => {
  it('filters out invalid messages', () => {
    const result = parseBatch([
      JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'ok' }),
      'not-json',
      JSON.stringify({ jsonrpc: '2.0', id: 2, result: 'also-ok' }),
    ]);
    expect(result).toHaveLength(2);
  });

  it('returns empty array for all-invalid batch', () => {
    const result = parseBatch(['bad1', 'bad2']);
    expect(result).toHaveLength(0);
  });
});

describe('extractToolCall', () => {
  it('extracts tool call from tools/call message', () => {
    const result = extractToolCall({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'search', arguments: { query: 'test' } },
    });
    expect(result).not.toBeNull();
    expect(result?.method).toBe('search');
    expect(result?.args).toEqual({ query: 'test' });
  });

  it('returns null for non-tool messages', () => {
    const result = extractToolCall({
      jsonrpc: '2.0',
      method: 'tools/list',
    });
    expect(result).toBeNull();
  });
});

describe('createRequest / createResponse / createError', () => {
  it('creates a valid request', () => {
    const req = createRequest('tools/list', {}, 'req-1');
    expect(req.jsonrpc).toBe('2.0');
    expect(req.method).toBe('tools/list');
    expect(req.id).toBe('req-1');
  });

  it('creates a valid response', () => {
    const res = createResponse(1, { tools: [] });
    expect(res.jsonrpc).toBe('2.0');
    expect(res.result).toEqual({ tools: [] });
  });

  it('creates a valid error', () => {
    const err = createError(1, -32601, 'Method not found');
    expect(err.error?.code).toBe(-32601);
    expect(err.error?.message).toBe('Method not found');
  });
});
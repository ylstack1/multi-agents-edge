import { z } from 'zod';

export const MCPEndpointSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  transport: z.enum(['sse', 'stdio']).default('sse'),
  apiKey: z.string().optional(),
  headers: z.record(z.string()).optional(),
  timeoutMs: z.number().positive().default(15000),
  enabled: z.boolean().default(true),
});

export type MCPEndpoint = z.infer<typeof MCPEndpointSchema>;

export const MCPToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()),
  endpointId: z.string().optional(),
});

export type MCPTool = z.infer<typeof MCPToolSchema>;

export const MCPToolCallRequestSchema = z.object({
  toolName: z.string(),
  arguments: z.record(z.unknown()),
  endpointUrl: z.string().url(),
  timeoutMs: z.number().positive().default(15000),
});

export type MCPToolCallRequest = z.infer<typeof MCPToolCallRequestSchema>;

export const MCPToolCallResultSchema = z.object({
  toolName: z.string(),
  content: z.array(
    z.object({
      type: z.enum(['text', 'image', 'resource']),
      text: z.string().optional(),
      mimeType: z.string().optional(),
      uri: z.string().optional(),
    }),
  ),
  isError: z.boolean().default(false),
  durationMs: z.number().optional(),
});

export type MCPToolCallResult = z.infer<typeof MCPToolCallResultSchema>;

export const MCPDiscoveryResultSchema = z.object({
  endpointId: z.string(),
  status: z.enum(['connected', 'failed']),
  tools: z.array(MCPToolSchema).optional(),
  error: z.string().optional(),
  latencyMs: z.number().optional(),
});

export type MCPDiscoveryResult = z.infer<typeof MCPDiscoveryResultSchema>;

export const MCPToolAssignmentSchema = z.object({
  endpointId: z.string(),
  scope: z.enum(['global', 'agent']),
  agentIds: z.array(z.string()).optional(),
});

export type MCPToolAssignment = z.infer<typeof MCPToolAssignmentSchema>;
import { z } from 'zod';

export const TraceNodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    'user_request',
    'lead_analysis',
    'sub_agent_assignment',
    'mcp_tool_execution',
    'lead_synthesis',
    'error',
    'system_action',
  ]),
  label: z.string(),
  description: z.string().optional(),
  timestamp: z.number(),
  durationMs: z.number().optional(),
  status: z.enum(['success', 'running', 'error', 'timeout']),
  parentId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TraceNode = z.infer<typeof TraceNodeSchema>;

export const ExecutionTraceSchema = z.object({
  traceId: z.string(),
  sessionId: z.string(),
  startedAt: z.number(),
  completedAt: z.number().optional(),
  nodes: z.array(TraceNodeSchema),
  status: z.enum(['running', 'completed', 'failed']),
});

export type ExecutionTrace = z.infer<typeof ExecutionTraceSchema>;

export const DiffLogEntrySchema = z.object({
  agentId: z.string(),
  fileName: z.string(),
  reasoning: z.string(),
  timestamp: z.number(),
  diff: z.array(
    z.object({
      type: z.enum(['added', 'removed', 'unchanged']),
      line: z.string(),
      lineNumber: z.number(),
    }),
  ),
});

export type DiffLogEntry = z.infer<typeof DiffLogEntrySchema>;
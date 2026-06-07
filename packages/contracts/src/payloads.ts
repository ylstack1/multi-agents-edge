import { z } from 'zod';

export const IngressPayloadSchema = z.object({
  sessionId: z.string(),
  source: z.enum(['TELEGRAM', 'WEB_UI']),
  targetAgentId: z.string(),
  content: z.string(),
});

export type IngressPayload = z.infer<typeof IngressPayloadSchema>;

export const ModifySubAgentPayloadSchema = z.object({
  targetAgentId: z.string().min(1),
  fileToModify: z.enum(['soul.md', 'identity.md', 'user.md', 'memory.md', 'tools.md']),
  newContent: z.string(),
  reasoning: z.string().min(1, 'Reasoning is required for audit trail'),
});

export type ModifySubAgentPayload = z.infer<typeof ModifySubAgentPayloadSchema>;

/**
 * The Lead Agent's internal tool for spawning a brand new Sub-agent.
 */
export const SpawnSubAgentPayloadSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().optional(),
  soul: z.string().optional(),
  identity: z.string().optional(),
  tools: z.string().optional(),
  reasoning: z.string().min(1),
});

export type SpawnSubAgentPayload = z.infer<typeof SpawnSubAgentPayloadSchema>;

export const FileUpdatePayloadSchema = z.object({
  filePath: z.string(),
  content: z.string(),
  reasoning: z.string().optional(),
});

export type FileUpdatePayload = z.infer<typeof FileUpdatePayloadSchema>;

export const ResetMemoryPayloadSchema = z.object({
  agentId: z.string(),
  confirm: z.literal(true),
});

export type ResetMemoryPayload = z.infer<typeof ResetMemoryPayloadSchema>;

/**
 * Web UI API response wrapper.
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.boolean(),
    data: data.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
      })
      .optional(),
    meta: z
      .object({
        requestId: z.string().optional(),
        durationMs: z.number().optional(),
      })
      .optional(),
  });

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { requestId?: string; durationMs?: number };
};
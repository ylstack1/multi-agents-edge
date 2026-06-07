import { z } from 'zod';

export const AgentWorkspaceSchema = z.object({
  agentId: z.string().min(1),
  files: z.record(
    z.enum(['soul.md', 'identity.md', 'user.md', 'memory.md', 'tools.md']),
    z.string().nullable(),
  ),
  lastModifiedEpochMs: z.number().positive(),
  workspaceSizeBytes: z.number().nonnegative().optional(),
});

export type AgentWorkspace = z.infer<typeof AgentWorkspaceSchema>;

export const WorkspaceListEntrySchema = z.object({
  agentId: z.string(),
  agentType: z.enum(['LEAD', 'SUB_AGENT']),
  status: z.enum(['ACTIVE', 'PAUSED', 'ERROR']).default('ACTIVE'),
  lastModifiedEpochMs: z.number().positive(),
  fileCount: z.number().nonnegative(),
});

export type WorkspaceListEntry = z.infer<typeof WorkspaceListEntrySchema>;

export const FileWriteRequestSchema = z.object({
  agentId: z.string(),
  fileName: z.enum(['soul.md', 'identity.md', 'user.md', 'memory.md', 'tools.md']),
  content: z.string(),
  reasoning: z.string().optional(),
});

export type FileWriteRequest = z.infer<typeof FileWriteRequestSchema>;

export const FileReadResponseSchema = z.object({
  agentId: z.string(),
  fileName: z.string(),
  content: z.string().nullable(),
  lastModifiedEpochMs: z.number().positive(),
});

export type FileReadResponse = z.infer<typeof FileReadResponseSchema>;

export const WorkspaceDiffEntrySchema = z.object({
  type: z.enum(['added', 'removed', 'unchanged']),
  line: z.string(),
  lineNumber: z.number(),
  reasoning: z.string().optional(),
});

export type WorkspaceDiffEntry = z.infer<typeof WorkspaceDiffEntrySchema>;

export const WorkspaceDiffSchema = z.object({
  agentId: z.string(),
  fileName: z.string(),
  entries: z.array(WorkspaceDiffEntrySchema),
  reasoning: z.string().optional(),
  timestamp: z.number(),
});

export type WorkspaceDiff = z.infer<typeof WorkspaceDiffSchema>;
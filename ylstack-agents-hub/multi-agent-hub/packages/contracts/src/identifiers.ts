/** Branded string — use the factory function to construct */
export type AgentId = string & { readonly __brand_agent_id: unique symbol };
export type SessionId = string & { readonly __brand_session_id: unique symbol };
export type AuthToken = string & { readonly __brand_auth_token: unique symbol };
export type WorkspaceId = string & { readonly __brand_workspace_id: unique symbol };

// -- Factory functions (safe creation with Zod validation in the caller) --

export function AgentId(id: string): AgentId {
  return id as AgentId;
}
export function SessionId(id: string): SessionId {
  return id as SessionId;
}
export function AuthToken(token: string): AuthToken {
  return token as AuthToken;
}
export function WorkspaceId(id: string): WorkspaceId {
  return id as WorkspaceId;
}

/** The canonical set of markdown files that define an agent workspace. */
export type MarkdownFileName =
  | 'soul.md'
  | 'identity.md'
  | 'user.md'
  | 'memory.md'
  | 'tools.md';

export const MARKDOWN_FILE_NAMES: readonly MarkdownFileName[] = [
  'soul.md',
  'identity.md',
  'user.md',
  'memory.md',
  'tools.md',
] as const;

export function isValidMarkdownFileName(s: string): s is MarkdownFileName {
  return (MARKDOWN_FILE_NAMES as readonly string[]).includes(s);
}
export class AgentHubError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly recoverable: boolean;

  constructor(opts: {
    code: string;
    message: string;
    statusCode?: number;
    recoverable?: boolean;
    cause?: unknown;
  }) {
    super(opts.message, { cause: opts.cause });
    this.name = 'AgentHubError';
    this.code = opts.code;
    this.statusCode = opts.statusCode ?? 500;
    this.recoverable = opts.recoverable ?? false;
  }
}

export class WorkspaceNotFoundError extends AgentHubError {
  constructor(agentId: string) {
    super({
      code: 'WORKSPACE_NOT_FOUND',
      message: `Workspace not found for agent: ${agentId}`,
      statusCode: 404,
      recoverable: false,
    });
    this.name = 'WorkspaceNotFoundError';
  }
}

export class FileNotFoundError extends AgentHubError {
  constructor(agentId: string, fileName: string) {
    super({
      code: 'FILE_NOT_FOUND',
      message: `File "${fileName}" not found in workspace "${agentId}"`,
      statusCode: 404,
      recoverable: false,
    });
    this.name = 'FileNotFoundError';
  }
}

export class InvalidWorkspaceError extends AgentHubError {
  constructor(details: string) {
    super({
      code: 'INVALID_WORKSPACE',
      message: `Invalid workspace state: ${details}`,
      statusCode: 400,
      recoverable: false,
    });
    this.name = 'InvalidWorkspaceError';
  }
}

export class UnauthorizedError extends AgentHubError {
  constructor(message = 'Unauthorized access') {
    super({
      code: 'UNAUTHORIZED',
      message,
      statusCode: 401,
      recoverable: false,
    });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AgentHubError {
  constructor(message = 'Forbidden') {
    super({
      code: 'FORBIDDEN',
      message,
      statusCode: 403,
      recoverable: false,
    });
    this.name = 'ForbiddenError';
  }
}

export class PathTraversalError extends AgentHubError {
  constructor(path: string) {
    super({
      code: 'PATH_TRAVERSAL',
      message: `Path traversal detected and blocked: ${path}`,
      statusCode: 400,
      recoverable: false,
    });
    this.name = 'PathTraversalError';
  }
}

export class MCPConnectionError extends AgentHubError {
  constructor(url: string, cause?: unknown) {
    super({
      code: 'MCP_CONNECTION_FAILED',
      message: `Failed to connect to MCP server: ${url}`,
      statusCode: 502,
      recoverable: true,
      cause,
    });
    this.name = 'MCPConnectionError';
  }
}

export class MCPTimeoutError extends AgentHubError {
  constructor(url: string, timeoutMs: number) {
    super({
      code: 'MCP_TIMEOUT',
      message: `MCP server "${url}" timed out after ${timeoutMs}ms`,
      statusCode: 504,
      recoverable: true,
    });
    this.name = 'MCPTimeoutError';
  }
}

export class LLMError extends AgentHubError {
  constructor(message: string, cause?: unknown) {
    super({
      code: 'LLM_ERROR',
      message,
      statusCode: 502,
      recoverable: true,
      cause,
    });
    this.name = 'LLMError';
  }
}

export class PromptOverflowError extends AgentHubError {
  constructor(estimatedTokens: number, maxTokens: number) {
    super({
      code: 'PROMPT_OVERFLOW',
      message: `Prompt exceeds token limit: ${estimatedTokens} > ${maxTokens}`,
      statusCode: 413,
      recoverable: true,
    });
    this.name = 'PromptOverflowError';
  }
}
import type { StorageBackend } from '@midas/vfs';
import { MARKDOWN_FILE_NAMES, isValidMarkdownFileName } from '@midas/contracts';
import type { MCPClient } from '@midas/mcp-edge';

/**
 * Result of a system tool execution.
 */
export interface SystemToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * System Tools Controller — the privileged tool set injected into the Lead Agent.
 * Enforces strict path traversal sanitization and validates all file operations.
 */
export class SystemToolsController {
  constructor(
    private storage: StorageBackend,
    private mcpClients: Map<string, MCPClient> = new Map(),
  ) {}

  // ── Tool Definitions (for LLM function calling) ──────────────

  getToolDefinitions() {
    return [
      {
        type: 'function' as const,
        function: {
          name: 'list_agents',
          description: 'List all agent workspaces in the system.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'read_workspace_file',
          description: 'Read the contents of a workspace file for any agent. Only valid markdown files allowed.',
          parameters: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'The agent ID to read from' },
              fileName: { type: 'string', enum: [...MARKDOWN_FILE_NAMES] },
            },
            required: ['agentId', 'fileName'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'modify_agent_file',
          description: 'Modify any workspace file for a sub-agent. Only valid markdown file names allowed.',
          parameters: {
            type: 'object',
            properties: {
              targetAgentId: { type: 'string', description: 'The sub-agent ID to modify' },
              fileToModify: { type: 'string', enum: [...MARKDOWN_FILE_NAMES] },
              newContent: { type: 'string', description: 'Full new content for the file' },
              reasoning: { type: 'string', description: 'Why this change is needed' },
            },
            required: ['targetAgentId', 'fileToModify', 'newContent', 'reasoning'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'spawn_agent',
          description: 'Create a new sub-agent with a fresh workspace.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name for the new sub-agent' },
              description: { type: 'string', description: 'Purpose description' },
              soul: { type: 'string', description: 'Optional soul.md content defining personality' },
              identity: { type: 'string', description: 'Optional identity.md content' },
              tools: { type: 'string', description: 'Optional tools.md content listing capabilities' },
              reasoning: { type: 'string', description: 'Why this agent is needed' },
            },
            required: ['name', 'reasoning'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'delete_agent',
          description: 'Delete a sub-agent and its entire workspace permanently.',
          parameters: {
            type: 'object',
            properties: {
              targetAgentId: { type: 'string', description: 'The sub-agent ID to delete' },
              reasoning: { type: 'string', description: 'Why this agent is being removed' },
            },
            required: ['targetAgentId', 'reasoning'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'rename_agent',
          description: 'Rename a sub-agent by updating its identity.md.',
          parameters: {
            type: 'object',
            properties: {
              targetAgentId: { type: 'string', description: 'The sub-agent ID to rename' },
              newName: { type: 'string', description: 'The new display name' },
              reasoning: { type: 'string', description: 'Why this rename is needed' },
            },
            required: ['targetAgentId', 'newName', 'reasoning'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'execute_mcp_tool',
          description: 'Execute an external MCP tool for a connected MCP server. Use this to interact with external APIs, databases, and services.',
          parameters: {
            type: 'object',
            properties: {
              endpointId: { type: 'string', description: 'The MCP endpoint ID to execute on' },
              toolName: { type: 'string', description: 'The tool name to execute' },
              arguments: { type: 'object', description: 'Tool arguments as a JSON object' },
              reasoning: { type: 'string', description: 'Why this tool call is needed' },
            },
            required: ['endpointId', 'toolName', 'arguments', 'reasoning'],
          },
        },
      },
    ];
  }

  // ── Tool Execution ──────────────────────────────────────────

  async execute(name: string, args: Record<string, unknown>): Promise<SystemToolResult> {
    switch (name) {
      case 'list_agents':
        return this.listAgents();
      case 'read_workspace_file':
        return this.readFile(args);
      case 'modify_agent_file':
        return this.modifyAgentFile(args);
      case 'spawn_agent':
        return this.spawnAgent(args);
      case 'delete_agent':
        return this.deleteAgent(args);
      case 'rename_agent':
        return this.renameAgent(args);
      case 'execute_mcp_tool':
        return this.executeMcpTool(args);
      default:
        return { success: false, message: `Unknown system tool: ${name}` };
    }
  }

  private sanitizeAgentId(agentId: string): void {
    if (!agentId || agentId.includes('..') || agentId.includes('/') || agentId.includes('\\')) {
      throw new Error(`Path traversal detected: invalid agentId "${agentId}"`);
    }
  }

  private async listAgents(): Promise<SystemToolResult> {
    try {
      const keys = await this.storage.listObjects('');
      const agentIds = [...new Set(keys.map((k) => k.split('/')[0]).filter(Boolean))];
      return {
        success: true,
        message: `Found ${agentIds.length} agent(s)`,
        data: { agents: agentIds },
      };
    } catch (err) {
      return { success: false, message: `Failed to list agents: ${err}` };
    }
  }

  private async readFile(args: Record<string, unknown>): Promise<SystemToolResult> {
    const { agentId, fileName } = args as { agentId: string; fileName: string };
    this.sanitizeAgentId(agentId);
    if (!isValidMarkdownFileName(fileName)) {
      return { success: false, message: `Invalid file name: ${fileName}` };
    }
    try {
      const { content } = await this.storage.getObject(agentId, fileName);
      return {
        success: true,
        message: content !== null ? `Read ${agentId}/${fileName}` : `File not found: ${agentId}/${fileName}`,
        data: { agentId, fileName, content: content ?? '', exists: content !== null },
      };
    } catch (err) {
      return { success: false, message: `Failed to read file: ${err}` };
    }
  }

  private async modifyAgentFile(args: Record<string, unknown>): Promise<SystemToolResult> {
    const { targetAgentId, fileToModify, newContent, reasoning } = args as {
      targetAgentId: string;
      fileToModify: string;
      newContent: string;
      reasoning: string;
    };
    this.sanitizeAgentId(targetAgentId);
    if (!isValidMarkdownFileName(fileToModify)) {
      return { success: false, message: `Invalid file name: ${fileToModify}` };
    }
    try {
      await this.storage.putObject(targetAgentId, fileToModify, newContent);
      return {
        success: true,
        message: `Updated ${targetAgentId}/${fileToModify}`,
        data: { agentId: targetAgentId, file: fileToModify, reasoning },
      };
    } catch (err) {
      return { success: false, message: `Failed to modify file: ${err}` };
    }
  }

  private async spawnAgent(args: Record<string, unknown>): Promise<SystemToolResult> {
    const { name, description, soul, identity, tools, reasoning } = args as {
      name: string;
      description?: string;
      soul?: string;
      identity?: string;
      tools?: string;
      reasoning: string;
    };
    const agentId = `sub-${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    this.sanitizeAgentId(agentId);

    try {
      await this.storage.putObject(agentId, 'soul.md', soul ?? `# Soul\n\n## Purpose\n${description ?? 'Specialized sub-agent'}\n## Values\n- Precision\n- Isolation\n- Task completion\n`);
      await this.storage.putObject(agentId, 'identity.md', identity ?? `# Identity\n\n**Name:** ${name}\n**Role:** Sub-agent\n**Type:** SPECIALIZED\n`);
      await this.storage.putObject(agentId, 'user.md', '# User Context\n\n*To be populated on delegation.*\n');
      await this.storage.putObject(agentId, 'memory.md', `# Memory\n\n*Created: ${new Date().toISOString()}*\n`);
      await this.storage.putObject(agentId, 'tools.md', tools ?? '# Tools\n\n*No MCP tools assigned yet.*\n');

      return {
        success: true,
        message: `Sub-agent "${name}" (${agentId}) created`,
        data: { agentId, name, reasoning, filesCreated: [...MARKDOWN_FILE_NAMES] },
      };
    } catch (err) {
      return { success: false, message: `Failed to spawn agent: ${err}` };
    }
  }

  private async deleteAgent(args: Record<string, unknown>): Promise<SystemToolResult> {
    const { targetAgentId, reasoning } = args as { targetAgentId: string; reasoning: string };
    this.sanitizeAgentId(targetAgentId);

    try {
      const keys = await this.storage.listObjects(`${targetAgentId}/`);
      await Promise.all(keys.map((key) => {
        const parts = key.split('/');
        const fileName = parts[1];
        if (fileName && isValidMarkdownFileName(fileName)) {
          return this.storage.deleteObject(targetAgentId, fileName);
        }
        return Promise.resolve();
      }));
      return {
        success: true,
        message: `Sub-agent "${targetAgentId}" deleted`,
        data: { agentId: targetAgentId, reasoning, filesDeleted: keys.length },
      };
    } catch (err) {
      return { success: false, message: `Failed to delete agent: ${err}` };
    }
  }

  private async renameAgent(args: Record<string, unknown>): Promise<SystemToolResult> {
    const { targetAgentId, newName, reasoning } = args as { targetAgentId: string; newName: string; reasoning: string };
    this.sanitizeAgentId(targetAgentId);

    try {
      const { content: existingIdentity } = await this.storage.getObject(targetAgentId, 'identity.md');
      const updatedIdentity = existingIdentity
        ? existingIdentity.replace(/^\*\*Name:\*\* .*/m, `**Name:** ${newName}`)
        : `# Identity\n\n**Name:** ${newName}\n**Role:** Sub-agent\n`;
      await this.storage.putObject(targetAgentId, 'identity.md', updatedIdentity);
      return {
        success: true,
        message: `Sub-agent "${targetAgentId}" renamed to "${newName}"`,
        data: { agentId: targetAgentId, newName, reasoning },
      };
    } catch (err) {
      return { success: false, message: `Failed to rename agent: ${err}` };
    }
  }

  private async executeMcpTool(args: Record<string, unknown>): Promise<SystemToolResult> {
    const { endpointId, toolName, arguments: toolArgs, reasoning } = args as {
      endpointId: string;
      toolName: string;
      arguments: Record<string, unknown>;
      reasoning: string;
    };

    const client = this.mcpClients.get(endpointId);
    if (!client) {
      return { success: false, message: `MCP endpoint "${endpointId}" not configured. Use /api/mcp/discover first.` };
    }

    try {
      const result = await client.executeTool(toolName, toolArgs);
      return {
        success: true,
        message: `MCP tool "${toolName}" executed on "${endpointId}"`,
        data: {
          endpointId,
          toolName,
          reasoning,
          result: typeof result === 'string' ? result : JSON.stringify(result),
        },
      };
    } catch (err) {
      return { success: false, message: `MCP tool execution failed: ${err}` };
    }
  }

  /**
   * Get a summary of all MCP clients and their available tools for display.
   */
  async getMcpCapabilitiesSummary(): Promise<Array<{ endpointId: string; toolCount: number; toolNames: string[] }>> {
    const summaries: Array<{ endpointId: string; toolCount: number; toolNames: string[] }> = [];
    for (const [endpointId, client] of this.mcpClients) {
      try {
        const tools = await client.discoverTools();
        summaries.push({
          endpointId,
          toolCount: tools.length,
          toolNames: tools.map((t) => t.name),
        });
      } catch {
        summaries.push({ endpointId, toolCount: 0, toolNames: [] });
      }
    }
    return summaries;
  }
}
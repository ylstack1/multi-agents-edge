import type { AgentWorkspace, CompiledPrompt, LLMConfig } from '@midas/contracts';
import type { AIProvider, CompletionResponse } from '@midas/ai-provider';
import { WorkspaceHydrator } from '@midas/vfs';
import { buildPrompt } from '@midas/compiler';

/**
 * Lead Agent Workflow — the privileged orchestrator.
 * Has global read/write on all workspaces and can spawn/modify sub-agents.
 */
export class LeadWorkflow {
  private hydrator: WorkspaceHydrator;
  private aiProvider: AIProvider;
  private leadId: string;
  private defaultConfig: LLMConfig;

  constructor(
    hydrator: WorkspaceHydrator,
    aiProvider: AIProvider,
    leadId = 'lead',
    defaultConfig?: Partial<LLMConfig>,
  ) {
    this.hydrator = hydrator;
    this.aiProvider = aiProvider;
    this.leadId = leadId;
    this.defaultConfig = {
      model: defaultConfig?.model || '@cf/meta/llama-3.2-3b-instruct',
      temperature: defaultConfig?.temperature ?? 0.7,
      maxTokens: defaultConfig?.maxTokens ?? 8192,
      stream: false,
      provider: defaultConfig?.provider || 'workers-ai',
    };
  }

  /**
   * Process a user request through the Lead Agent.
   * 1. Hydrate Lead's workspace
   * 2. Compile the system prompt
   * 3. Invoke LLM with admin system tools injected
   * 4. Handle any tool calls (modify agents, spawn agents)
   * 5. Synthesize final response
   */
  async processUserRequest(userMessage: string): Promise<{
    response: CompletionResponse;
    compiledPrompt: CompiledPrompt;
    toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }>;
  }> {
    const workspace = await this.hydrator.readWorkspace(this.leadId);
    const { compiled } = buildPrompt({
      workspace,
      userMessage,
    });

    // Inject system-level admin tools
    const systemTools = this.getSystemTools();

    const response = await this.aiProvider.complete({
      systemPrompt: compiled.systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools: systemTools,
      config: {
        model: this.defaultConfig.model,
        temperature: this.defaultConfig.temperature,
        maxTokens: this.defaultConfig.maxTokens,
        stream: false,
        provider: this.defaultConfig.provider,
      },
    });

    const toolCallResults: Array<{ name: string; args: Record<string, unknown>; result: unknown }> = [];

    // Handle tool calls
    if (response.toolCalls) {
      for (const tc of response.toolCalls) {
        try {
          const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          const result = await this.executeSystemTool(tc.function.name, args);
          toolCallResults.push({ name: tc.function.name, args, result });
        } catch (err) {
          toolCallResults.push({
            name: tc.function.name,
            args: {},
            result: { error: err instanceof Error ? err.message : 'Tool execution failed' },
          });
        }
      }

      // If there were tool calls, synthesize the final response
      if (toolCallResults.length > 0) {
        const synthesisResponse = await this.synthesizeResponse(userMessage, toolCallResults);
        return {
          response: synthesisResponse,
          compiledPrompt: compiled,
          toolCalls: toolCallResults,
        };
      }
    }

    return {
      response,
      compiledPrompt: compiled,
      toolCalls: toolCallResults,
    };
  }

  private getSystemTools() {
    return [
      {
        type: 'function' as const,
        function: {
          name: 'modify_sub_agent',
          description: 'Modify a sub-agent workspace file. Only valid markdown file names are allowed.',
          parameters: {
            type: 'object',
            properties: {
              targetAgentId: { type: 'string', description: 'The sub-agent ID to modify' },
              fileToModify: {
                type: 'string',
                enum: ['soul.md', 'identity.md', 'user.md', 'memory.md', 'tools.md'],
              },
              newContent: { type: 'string', description: 'The full new content for the file' },
              reasoning: { type: 'string', description: 'Explanation of why this change is needed' },
            },
            required: ['targetAgentId', 'fileToModify', 'newContent', 'reasoning'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'spawn_sub_agent',
          description: 'Create a new sub-agent with a fresh workspace.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name for the new sub-agent' },
              description: { type: 'string', description: 'Purpose description' },
              soul: { type: 'string', description: 'Optional soul.md content' },
              identity: { type: 'string', description: 'Optional identity.md content' },
              tools: { type: 'string', description: 'Optional tools.md content' },
              reasoning: { type: 'string', description: 'Why this agent is needed' },
            },
            required: ['name', 'reasoning'],
          },
        },
      },
    ];
  }

  private async executeSystemTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'modify_sub_agent': {
        const { targetAgentId, fileToModify, newContent, reasoning } = args as {
          targetAgentId: string;
          fileToModify: 'soul.md' | 'identity.md' | 'user.md' | 'memory.md' | 'tools.md';
          newContent: string;
          reasoning: string;
        };

        // Path traversal protection
        if (targetAgentId.includes('..') || targetAgentId.includes('/')) {
          throw new Error('Path traversal detected: invalid agentId');
        }

        await this.hydrator.writeFile(targetAgentId, fileToModify, newContent);
        return { success: true, agentId: targetAgentId, file: fileToModify, reasoning };
      }

      case 'spawn_sub_agent': {
        const { name, description, soul, identity, tools, reasoning } = args as {
          name: string;
          description?: string;
          soul?: string;
          identity?: string;
          tools?: string;
          reasoning: string;
        };

        const agentId = `sub-${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

        await this.hydrator.writeFile(agentId, 'soul.md', soul ?? `# Soul\n\nPurpose: ${description ?? 'Specialized agent'}\n`);
        await this.hydrator.writeFile(agentId, 'identity.md', identity ?? `# Identity\n\nName: ${name}\nRole: Sub-agent`);
        await this.hydrator.writeFile(agentId, 'user.md', '# User Context\n\n*Populated on delegation*');
        await this.hydrator.writeFile(agentId, 'memory.md', `# Memory\n\nCreated: ${new Date().toISOString()}\n`);
        await this.hydrator.writeFile(agentId, 'tools.md', tools ?? '# Tools\n\n*No tools assigned*');

        return { success: true, agentId, name, reasoning };
      }

      default:
        throw new Error(`Unknown system tool: ${name}`);
    }
  }

  private async synthesizeResponse(
    userMessage: string,
    toolResults: Array<{ name: string; args: Record<string, unknown>; result: unknown }>,
  ): Promise<CompletionResponse> {
    const synthesisPrompt = `You are the Lead Agent synthesizer. A user made a request, and you executed system tools. Summarize what happened in a clear, friendly way.

User request: "${userMessage}"

Tool executions:
${toolResults.map((t) => `- ${t.name}: ${JSON.stringify(t.result)}`).join('\n')}

Provide a concise summary of what was done and the current state.`;

    return this.aiProvider.complete({
      systemPrompt: synthesisPrompt,
      messages: [],
      config: {
        model: this.defaultConfig.model,
        temperature: 0.5,
        maxTokens: 1024,
        stream: false,
        provider: 'openai',
      },
    });
  }
}
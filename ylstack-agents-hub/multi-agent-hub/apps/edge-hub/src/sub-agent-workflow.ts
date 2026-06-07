import type { AgentWorkspace, CompiledPrompt } from '@midas/contracts';
import type { AIProvider, CompletionResponse } from '@midas/ai-provider';
import { WorkspaceHydrator, DeferredFlusher } from '@midas/vfs';
import { buildPrompt } from '@midas/compiler';

/**
 * Sub-Agent Workflow — sandboxed execution.
 * Strictly isolated: only reads/writes its own workspace, has no knowledge of the Lead Agent.
 */
export class SubAgentWorkflow {
  private hydrator: WorkspaceHydrator;
  private flusher: DeferredFlusher;
  private aiProvider: AIProvider;
  private agentId: string;

  constructor(
    hydrator: WorkspaceHydrator,
    flusher: DeferredFlusher,
    aiProvider: AIProvider,
    agentId: string,
  ) {
    this.hydrator = hydrator;
    this.flusher = flusher;
    this.aiProvider = aiProvider;
    this.agentId = agentId;
  }

  /**
   * Process a user message through this sub-agent.
   * Strictly limited to its own workspace files and assigned MCP tools.
   */
  async processMessage(
    userMessage: string,
    waitUntil?: (p: Promise<unknown>) => void,
  ): Promise<{
    response: CompletionResponse;
    compiledPrompt: CompiledPrompt;
    memoryUpdated: boolean;
  }> {
    // 1. Read own workspace only
    const workspace = await this.hydrator.readWorkspace(this.agentId);

    // 2. Compile prompt from own files
    const { compiled } = buildPrompt({
      workspace,
      userMessage,
    });

    // 3. Extract tools from own tools.md
    const toolDefinitions = this.extractLocalTools(workspace);

    // 4. Invoke LLM
    const response = await this.aiProvider.complete({
      systemPrompt: compiled.systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools: toolDefinitions,
      config: {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 4096,
        stream: false,
        provider: 'openai',
      },
    });

    // 5. Append to own memory (async flush)
    const memoryEntry = this.createMemoryEntry(userMessage, response.content ?? '');
    let memoryUpdated = false;

    if (waitUntil) {
      const existingMemory = workspace.files['memory.md'] ?? '';
      const updatedMemory = existingMemory + '\n' + memoryEntry;
      this.flusher.scheduleFlush(waitUntil, this.agentId, 'memory.md', updatedMemory);
      memoryUpdated = true;
    }

    return {
      response,
      compiledPrompt: compiled,
      memoryUpdated,
    };
  }

  /**
   * Extract tool definitions from the sub-agent's tools.md file.
   * Only local tools — no system-level admin tools.
   */
  private extractLocalTools(workspace: AgentWorkspace) {
    const toolsMd = workspace.files['tools.md'];
    if (!toolsMd) return undefined;

    try {
      const parsed = JSON.parse(toolsMd);
      if (Array.isArray(parsed)) {
        return parsed.map((t: Record<string, unknown>) => ({
          type: 'function' as const,
          function: {
            name: String(t.name ?? 'unknown'),
            description: String(t.description ?? ''),
            parameters: (t.inputSchema ?? {}) as Record<string, unknown>,
          },
        }));
      }
    } catch {
      // tools.md contains plain text documentation — no tool definitions
    }
    return undefined;
  }

  private createMemoryEntry(userMessage: string, response: string): string {
    const timestamp = new Date().toISOString();
    return `\n## Session ${timestamp}\n**User:** ${userMessage}\n**Agent:** ${response}\n`;
  }
}
import type { CompiledPrompt, LLMConfig } from '@midas/contracts';
import type { AIProvider, CompletionResponse } from '@midas/ai-provider';
import { WorkspaceHydrator } from '@midas/vfs';
import { buildPrompt, extractToolDefinitions } from '@midas/compiler';
import { SystemToolsController } from './system-tools-controller.js';
import { ExecutionTracer } from './execution-tracer.js';

/**
 * Lead Agent Workflow — the privileged orchestrator.
 * Has global read/write on all workspaces and can spawn/modify/delete sub-agents.
 */
export class LeadWorkflow {
  private hydrator: WorkspaceHydrator;
  private aiProvider: AIProvider;
  private leadId: string;
  private defaultConfig: LLMConfig;
  private toolsController: SystemToolsController;
  private tracer: ExecutionTracer;

  constructor(
    hydrator: WorkspaceHydrator,
    aiProvider: AIProvider,
    toolsController: SystemToolsController,
    leadId = 'lead',
    defaultConfig?: Partial<LLMConfig>,
    tracer?: ExecutionTracer,
  ) {
    this.hydrator = hydrator;
    this.aiProvider = aiProvider;
    this.toolsController = toolsController;
    this.leadId = leadId;
    this.tracer = tracer ?? new ExecutionTracer(leadId);
    this.defaultConfig = {
      model: defaultConfig?.model || '@cf/meta/llama-3.2-3b-instruct',
      temperature: defaultConfig?.temperature ?? 0.7,
      maxTokens: defaultConfig?.maxTokens ?? 8192,
      stream: false,
      provider: defaultConfig?.provider || 'workers-ai',
    };
  }

  /**
   * Process a user request through the Lead Agent with multi-turn tool execution.
   */
  async processUserRequest(userMessage: string, maxToolRounds = 5): Promise<{
    response: CompletionResponse;
    compiledPrompt: CompiledPrompt;
    toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }>;
  }> {
    const requestNode = this.tracer.addNode({ type: 'user_request', label: 'User Request', status: 'running' });
    try {
      const workspace = await this.hydrator.readWorkspace(this.leadId);
      this.tracer.completeNode(requestNode.id, 'success');

      const compileNode = this.tracer.addNode({ type: 'reasoning', label: 'Compile Prompt', status: 'running' });
      const { compiled } = buildPrompt({ workspace, userMessage });
      this.tracer.completeNode(compileNode.id, 'success');

      // Inject system-level admin tools + workspace tools
      const systemTools = this.toolsController.getToolDefinitions();
      const toolsMd = workspace.files['tools.md'];
      const workspaceTools = (extractToolDefinitions(toolsMd ?? null) ?? []) as any[];
      const allTools = [...systemTools, ...workspaceTools];

      const toolCallResults: Array<{ name: string; args: Record<string, unknown>; result: unknown }> = [];
      let currentMessage = userMessage;
      let hasToolCalls = true;
      let rounds = 0;

      while (hasToolCalls && rounds < maxToolRounds) {
        rounds++;
        const llmNode = this.tracer.addNode({ type: 'llm', label: `LLM Call (round ${rounds})`, status: 'running' });

        const response = await this.aiProvider.complete({
          systemPrompt: compiled.systemPrompt,
          messages: [{ role: 'user', content: currentMessage }],
          tools: allTools,
          config: {
            model: this.defaultConfig.model,
            temperature: this.defaultConfig.temperature,
            maxTokens: this.defaultConfig.maxTokens,
            stream: false,
            provider: this.defaultConfig.provider,
          },
        });

        this.tracer.completeNode(llmNode.id, 'success');

        if (!response.toolCalls || response.toolCalls.length === 0) {
          hasToolCalls = false;
          this.tracer.addNode({ type: 'completion', label: 'Final Response', status: 'success' });

          // Persist memory
          await this.appendMemory(userMessage, response.content ?? '');

          return {
            response,
            compiledPrompt: compiled,
            toolCalls: toolCallResults,
          };
        }

        // Execute each tool call
        for (const tc of response.toolCalls) {
          const toolNode = this.tracer.addNode({
            type: 'tool_call', label: `Tool: ${tc.function.name}`, status: 'running',
          });
          try {
            const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
            const result = await this.toolsController.execute(tc.function.name, args);
            toolCallResults.push({ name: tc.function.name, args, result });
            this.tracer.completeNode(toolNode.id, result.success ? 'success' : 'error');
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Tool execution failed';
            toolCallResults.push({ name: tc.function.name, args: {}, result: { error: errorMsg } });
            this.tracer.errorNode(toolNode.id, errorMsg);
          }
        }

        // Prepare next round context
        currentMessage = `Previous tool execution results:\n${toolCallResults.map((t) =>
          `- ${t.name}: ${JSON.stringify(t.result)}`).join('\n')}\n\nBased on these results, provide a final response to the user's original request: "${userMessage}"`;
      }

      // Synthesize final response after tool execution loop
      const synthNode = this.tracer.addNode({ type: 'completion', label: 'Synthesize Response', status: 'running' });
      const finalResponse = await this.synthesizeResponse(userMessage, toolCallResults);
      this.tracer.completeNode(synthNode.id, 'success');

      // Persist memory
      await this.appendMemory(userMessage, finalResponse.content ?? '');

      this.tracer.complete();
      return { response: finalResponse, compiledPrompt: compiled, toolCalls: toolCallResults };
    } catch (err) {
      this.tracer.errorNode(requestNode.id, err instanceof Error ? err.message : 'Unknown error');
      this.tracer.complete();
      throw err;
    }
  }

  /** Append conversation to lead's memory.md */
  private async appendMemory(userMessage: string, responseContent: string): Promise<void> {
    try {
      const { content: existingMemory } = await this.hydrator['deps'].s3.getObject(this.leadId, 'memory.md');
      const timestamp = new Date().toISOString();
      const entry = `\n## Session ${timestamp}\n**User:** ${userMessage}\n**Lead:** ${responseContent}\n`;
      await this.hydrator.writeFile(this.leadId, 'memory.md', (existingMemory ?? '') + entry);
    } catch {
      // Memory append is non-critical
    }
  }

  /** Get the execution trace */
  getTrace() {
    return this.tracer.getTrace();
  }

  private async synthesizeResponse(
    userMessage: string,
    toolResults: Array<{ name: string; args: Record<string, unknown>; result: unknown }>,
  ): Promise<CompletionResponse> {
    const synthesisPrompt = `You are the Lead Agent synthesizer. Summarize what happened after executing system tools.

User request: "${userMessage}"

Tool results:
${toolResults.map((t) => `- ${t.name}: ${JSON.stringify(t.result)}`).join('\n')}

Provide a clear, friendly summary.`;

    return this.aiProvider.complete({
      systemPrompt: synthesisPrompt,
      messages: [],
      config: {
        model: this.defaultConfig.model,
        temperature: 0.5,
        maxTokens: 1024,
        stream: false,
        provider: this.defaultConfig.provider,
      },
    });
  }
}
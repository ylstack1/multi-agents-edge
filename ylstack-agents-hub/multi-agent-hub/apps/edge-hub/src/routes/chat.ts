import { Hono } from 'hono';
import { createProviderFromSettings } from '@midas/ai-provider';
import { buildPrompt, extractToolDefinitions } from '@midas/compiler';
import { SettingsStore } from '../settings-store.js';
import { createHydrator, R2BucketAdapter } from '../r2-adapter.js';
import { LeadWorkflow } from '../lead-workflow.js';
import { SystemToolsController } from '../system-tools-controller.js';
import { ExecutionTracer } from '../execution-tracer.js';
import type { Env } from '../../worker-configuration.d.ts';
import type { LLMConfig } from '@midas/contracts';

const chatRoutes = new Hono<{ Bindings: Env }>();

/** Resolve provider from settings with fallback chain */
async function resolveProvider(
  env: Env,
  preferredProvider?: string,
  preferredModel?: string,
) {
  const store = new SettingsStore(env.VFS_CACHE);
  const settings = await store.load();

  let provider = preferredProvider || settings.defaultProvider;
  let model = preferredModel || settings.defaultModel;

  // Check all providers (built-in + custom)
  const allProviders = { ...settings.providers, ...settings.customProviders };
  let setting = allProviders[provider];

  if (!setting?.enabled) {
    // Fallback to first enabled provider
    const enabled = Object.entries(allProviders).find(([, s]) => s.enabled);
    if (enabled) {
      provider = enabled[0];
      model = (enabled[1] as any).defaultModel || model;
      setting = enabled[1];
    } else {
      // Hard fallback to workers-ai
      provider = 'workers-ai';
      model = '@cf/meta/llama-3.2-3b-instruct';
      setting = settings.providers['workers-ai'];
    }
  }

  const merged: any = {
    provider: setting?.provider || provider,
    enabled: setting?.enabled ?? true,
    defaultModel: setting?.defaultModel || model,
    ...(setting?.baseUrl ? { baseUrl: setting.baseUrl } : {}),
    ...(setting?.models ? { models: setting.models } : {}),
    apiKey: setting?.apiKey ||
      (provider === 'openai' ? env.OPENAI_API_KEY : undefined) ||
      (provider === 'anthropic' ? env.ANTHROPIC_API_KEY : undefined),
  };

  const ai = provider === 'workers-ai' ? env.AI : undefined;

  return {
    instance: createProviderFromSettings(merged, ai),
    provider,
    model: model || merged?.defaultModel || '',
    config: {
      model: model || merged?.defaultModel || '',
      temperature: settings.defaultTemperature ?? 0.7,
      maxTokens: settings.defaultMaxTokens ?? 4096,
      stream: false,
      provider,
    } as LLMConfig,
  };
}

// Non-streaming chat
chatRoutes.post('/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const { message, model: preferredModel, provider: preferredProvider } = await c.req.json<{
    message: string;
    model?: string;
    provider?: string;
  }>();

  if (!message) {
    return c.json({ success: false, error: { code: 'MISSING_MESSAGE', message: 'Message is required' } }, 400);
  }

  const hydrator = createHydrator(c.env);
  const { instance: aiProvider, config, provider, model } = await resolveProvider(
    c.env, preferredProvider, preferredModel,
  );

  if (agentId === 'lead') {
    // ── Lead Agent: full system tool capabilities ──
    const storage = new R2BucketAdapter(c.env.WORKSPACE_BUCKET);
    const toolsController = new SystemToolsController(storage, new Map());
    const tracer = new ExecutionTracer(agentId);

    const workflow = new LeadWorkflow(
      hydrator,
      aiProvider,
      toolsController,
      agentId,
      config,
      tracer,
    );

    const result = await workflow.processUserRequest(message);

    // Map tool call execution results to web-friendly format
    const mappedToolCalls = result.toolCalls.map((tc) => ({
      name: tc.name,
      arguments: JSON.stringify(tc.args),
      result: typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result),
    }));

    return c.json({
      success: true,
      data: {
        content: result.response.content,
        toolCalls: mappedToolCalls.length > 0 ? mappedToolCalls : undefined,
        finishReason: result.response.finishReason,
        usage: result.response.usage,
        compiledPrompt: result.compiledPrompt,
        provider: config.provider || provider,
        model: config.model || model,
        trace: tracer.getTrace(),
      },
    });
  }

  // ── Sub-Agent: sandboxed workspace-only execution ──
  const workspace = await hydrator.readWorkspace(agentId);

  const { compiled } = buildPrompt({ workspace, userMessage: message });

  const toolsMd = workspace.files['tools.md'];
  const toolDefinitions = (extractToolDefinitions(toolsMd ?? null) ?? []) as any;

  const response = await aiProvider.complete({
    systemPrompt: compiled.systemPrompt,
    messages: [{ role: 'user', content: message }],
    tools: toolDefinitions,
    config,
  });

  return c.json({
    success: true,
    data: {
      content: response.content,
      toolCalls: response.toolCalls,
      finishReason: response.finishReason,
      usage: response.usage,
      compiledPrompt: compiled,
      provider: config.provider,
      model: config.model,
    },
  });
});

// Streaming chat endpoint with enhanced SSE output
chatRoutes.post('/:agentId/stream', async (c) => {
  const agentId = c.req.param('agentId');
  const { message, model: preferredModel, provider: preferredProvider } = await c.req.json<{
    message: string;
    model?: string;
    provider?: string;
  }>();

  if (!message) {
    return c.json({ success: false, error: { code: 'MISSING_MESSAGE', message: 'Message is required' } }, 400);
  }

  // Streaming is only supported for sub-agents (LeadWorkflow doesn't support streaming yet)
  if (agentId === 'lead') {
    return c.json({
      success: false,
      error: { code: 'STREAM_NOT_SUPPORTED', message: 'Streaming not supported for lead agent. Use non-streaming endpoint.' },
    }, 400);
  }

  const hydrator = createHydrator(c.env);
  const workspace = await hydrator.readWorkspace(agentId);

  const { compiled } = buildPrompt({ workspace, userMessage: message });

  const { instance: aiProvider, config, provider, model } = await resolveProvider(
    c.env, preferredProvider, preferredModel,
  );

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  c.header('X-Accel-Buffering', 'no');

  const streamConfig = { ...config, stream: true };

  const stream = new ReadableStream({
    async start(controller) {
      const enc = (data: string) => controller.enqueue(new TextEncoder().encode(data));

      try {
        // Emit provider/model info first
        enc(`data: ${JSON.stringify({ type: 'meta', provider, model })}\n\n`);

        const generator = aiProvider.streamComplete({
          systemPrompt: compiled.systemPrompt,
          messages: [{ role: 'user', content: message }],
          config: streamConfig,
        });

        for await (const chunk of generator) {
          enc(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        enc('data: [DONE]\n\n');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown streaming error';
        enc(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
      } finally {
        controller.close();
      }
    },
  });

  return c.body(stream);
});

export { chatRoutes };
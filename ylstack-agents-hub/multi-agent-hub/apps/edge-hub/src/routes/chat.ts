import { Hono } from 'hono';
import { createProvider } from '@midas/ai-provider';
import { WorkspaceHydrator } from '@midas/vfs';
import { S3FetchClient } from '@midas/vfs';
import { KVCacheManager } from '@midas/vfs';
import { buildPrompt, extractToolDefinitions } from '@midas/compiler';
import type { Env } from '../../worker-configuration.d.ts';

const chatRoutes = new Hono<{ Bindings: Env }>();

chatRoutes.post('/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const { message, model, provider } = await c.req.json<{
    message: string;
    model?: string;
    provider?: string;
  }>();

  if (!message) {
    return c.json({ success: false, error: { code: 'MISSING_MESSAGE', message: 'Message is required' } }, 400);
  }

  // Hydrate workspace
  const s3 = new S3FetchClient({
    r2Endpoint: 'https://r2.cloudflarestorage.com',
    r2Bucket: c.env.WORKSPACE_BUCKET.name,
  });
  const cache = new KVCacheManager(c.env.VFS_CACHE);
  const hydrator = new WorkspaceHydrator({ s3, cache });
  const workspace = await hydrator.readWorkspace(agentId);

  // Build prompt from workspace
  const { compiled } = buildPrompt({
    workspace,
    userMessage: message,
    config: { model: model ?? 'gpt-4o', provider: (provider as 'openai' | 'anthropic') ?? 'openai' },
  });

  // Extract tool definitions
  const toolsMd = workspace.files['tools.md'];
  const toolDefinitions = extractToolDefinitions(toolsMd);

  // Create AI provider
  const aiProvider = createProvider(
    { openaiApiKey: c.env.OPENAI_API_KEY, anthropicApiKey: c.env.ANTHROPIC_API_KEY },
    provider,
  );

  const response = await aiProvider.complete({
    systemPrompt: compiled.systemPrompt,
    messages: [],
    tools: toolDefinitions?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description ?? '',
        parameters: t.inputSchema as Record<string, unknown>,
      },
    })),
    config: {
      model: model ?? 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4096,
      stream: false,
      provider: (provider as 'openai' | 'anthropic') ?? 'openai',
    },
  });

  return c.json({
    success: true,
    data: {
      content: response.content,
      toolCalls: response.toolCalls,
      finishReason: response.finishReason,
      usage: response.usage,
      compiledPrompt: compiled,
    },
  });
});

// Streaming chat endpoint
chatRoutes.post('/:agentId/stream', async (c) => {
  const agentId = c.req.param('agentId');
  const { message, model, provider } = await c.req.json<{
    message: string;
    model?: string;
    provider?: string;
  }>();

  if (!message) {
    return c.json({ success: false, error: { code: 'MISSING_MESSAGE', message: 'Message is required' } }, 400);
  }

  // Hydrate workspace
  const s3 = new S3FetchClient({
    r2Endpoint: 'https://r2.cloudflarestorage.com',
    r2Bucket: c.env.WORKSPACE_BUCKET.name,
  });
  const cache = new KVCacheManager(c.env.VFS_CACHE);
  const hydrator = new WorkspaceHydrator({ s3, cache });
  const workspace = await hydrator.readWorkspace(agentId);

  // Build prompt
  const { compiled } = buildPrompt({
    workspace,
    userMessage: message,
  });

  // Create AI provider
  const aiProvider = createProvider(
    { openaiApiKey: c.env.OPENAI_API_KEY, anthropicApiKey: c.env.ANTHROPIC_API_KEY },
    provider,
  );

  // Set up SSE stream
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = aiProvider.streamComplete({
          systemPrompt: compiled.systemPrompt,
          messages: [{ role: 'user', content: message }],
          config: {
            model: model ?? 'gpt-4o',
            temperature: 0.7,
            maxTokens: 4096,
            stream: true,
            provider: (provider as 'openai' | 'anthropic') ?? 'openai',
          },
        });

        for await (const chunk of generator) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }

        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return c.body(stream);
});

export { chatRoutes };
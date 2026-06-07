import { Hono } from 'hono';
import { createProviderFromSettings } from '@midas/ai-provider';
import { WorkspaceHydrator } from '@midas/vfs';
import { S3FetchClient } from '@midas/vfs';
import { KVCacheManager } from '@midas/vfs';
import { buildPrompt, extractToolDefinitions } from '@midas/compiler';
import { SettingsStore } from '../settings-store.js';
import type { Env } from '../../worker-configuration.d.ts';

const chatRoutes = new Hono<{ Bindings: Env }>();

/** Resolve provider from settings with fallback */
async function resolveProvider(
  env: Env,
  preferredProvider?: string,
  preferredModel?: string,
) {
  const store = new SettingsStore(env.VFS_CACHE);
  const settings = await store.load();

  let provider = preferredProvider || settings.defaultProvider;
  let model = preferredModel || settings.defaultModel;
  const setting = settings.providers[provider];

  if (!setting?.enabled || !setting) {
    // Fallback to first enabled provider
    const enabled = Object.entries(settings.providers).find(([, s]) => s.enabled);
    if (enabled) {
      provider = enabled[0];
      model = enabled[1].defaultModel || model;
    } else {
      // Hard fallback to workers-ai
      provider = 'workers-ai';
      model = '@cf/meta/llama-3.2-3b-instruct';
    }
  }

  const merged = {
    ...settings.providers[provider],
    apiKey: settings.providers[provider]?.apiKey ||
      (provider === 'openai' ? env.OPENAI_API_KEY : undefined) ||
      (provider === 'anthropic' ? env.ANTHROPIC_API_KEY : undefined),
  };

  const ai = provider === 'workers-ai' ? env.AI : undefined;

  return {
    instance: createProviderFromSettings(merged, ai),
    provider,
    model,
    config: { model, temperature: 0.7, maxTokens: 4096, stream: false, provider } as any,
  };
}

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

  const s3 = new S3FetchClient({
    r2Endpoint: 'https://r2.cloudflarestorage.com',
    r2Bucket: 'midas-workspaces-dev',
  });
  const cache = new KVCacheManager(c.env.VFS_CACHE);
  const hydrator = new WorkspaceHydrator({ s3, cache });
  const workspace = await hydrator.readWorkspace(agentId);

  const { compiled } = buildPrompt({ workspace, userMessage: message });

  const toolsMd = workspace.files['tools.md'];
  const toolDefinitions = extractToolDefinitions(toolsMd ?? null);

  const { instance: aiProvider, config } = await resolveProvider(
    c.env, preferredProvider, preferredModel,
  );

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

// Streaming chat endpoint
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

  const s3 = new S3FetchClient({
    r2Endpoint: 'https://r2.cloudflarestorage.com',
    r2Bucket: 'midas-workspaces-dev',
  });
  const cache = new KVCacheManager(c.env.VFS_CACHE);
  const hydrator = new WorkspaceHydrator({ s3, cache });
  const workspace = await hydrator.readWorkspace(agentId);

  const { compiled } = buildPrompt({ workspace, userMessage: message });

  const { instance: aiProvider, config } = await resolveProvider(
    c.env, preferredProvider, preferredModel,
  );

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  const streamConfig = { ...config, stream: true };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = aiProvider.streamComplete({
          systemPrompt: compiled.systemPrompt,
          messages: [{ role: 'user', content: message }],
          config: streamConfig,
        });

        for await (const chunk of generator) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }

        controller.enqueue(new TextEncoder().encode(
          `data: ${JSON.stringify({ type: 'meta', provider: config.provider, model: config.model })}\n\n`,
        ));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return c.body(stream);
});

export { chatRoutes };
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { MARKDOWN_FILE_NAMES, isValidMarkdownFileName } from '@midas/contracts';
import { generateDiff, annotateDiff } from '@midas/compiler';
import { createHydrator } from '../r2-adapter.js';
import type { Env } from '../../worker-configuration.d.ts';

const workspaceRoutes = new Hono<{ Bindings: Env }>();

// List all workspaces
workspaceRoutes.get('/', async (c) => {
  const hydrator = createHydrator(c.env);
  const agentIds = await hydrator.listWorkspaces();
  return c.json({ success: true, data: agentIds });
});

// Get full workspace for an agent
workspaceRoutes.get('/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const hydrator = createHydrator(c.env);
  const workspace = await hydrator.readWorkspace(agentId);
  return c.json({ success: true, data: workspace });
});

// Get single file from workspace
workspaceRoutes.get('/:agentId/files/:fileName', async (c) => {
  const { agentId, fileName } = c.req.param();
  if (!isValidMarkdownFileName(fileName)) {
    return c.json({ success: false, error: { code: 'INVALID_FILE', message: `Invalid file: ${fileName}` } }, 400);
  }
  const hydrator = createHydrator(c.env);
  const workspace = await hydrator.readWorkspace(agentId);
  return c.json({ success: true, data: { agentId, fileName, content: workspace.files[fileName] } });
});

// Write file to workspace
workspaceRoutes.put('/:agentId/files/:fileName', async (c) => {
  const { agentId, fileName } = c.req.param();
  if (!isValidMarkdownFileName(fileName)) {
    return c.json({ success: false, error: { code: 'INVALID_FILE', message: `Invalid file: ${fileName}` } }, 400);
  }

  const body = await c.req.json<{ content: string; reasoning?: string }>();
  const hydrator = createHydrator(c.env);

  // Read existing content for diff
  const existing = await hydrator.readWorkspace(agentId);
  const oldContent = existing.files[fileName] ?? '';

  // Write new content
  await hydrator.writeFile(agentId, fileName, body.content);

  // Generate diff
  const diff = generateDiff(oldContent, body.content);
  const annotated = body.reasoning ? annotateDiff(diff, body.reasoning) : diff;

  return c.json({
    success: true,
    data: { agentId, fileName, diff: annotated },
  });
});

// Delete workspace
workspaceRoutes.delete('/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const hydrator = createHydrator(c.env);
  await hydrator.deleteWorkspace(agentId);
  return c.json({ success: true, data: { deleted: agentId } });
});

// Reset memory (clear memory.md, preserve soul/identity)
workspaceRoutes.post('/:agentId/reset-memory', async (c) => {
  const agentId = c.req.param('agentId');
  const hydrator = createHydrator(c.env);
  const workspace = await hydrator.readWorkspace(agentId);

  await hydrator.writeFile(agentId, 'memory.md', '# Memory\n\n*Episodic memory has been reset.*\n');

  return c.json({
    success: true,
    data: { agentId, message: 'Memory reset to baseline. Soul and identity preserved.' },
  });
});

export { workspaceRoutes };
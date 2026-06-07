import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { generateDiff } from '@midas/compiler';
import { createHydrator } from '../r2-adapter.js';
import type { Env } from '../../worker-configuration.d.ts';

const agentRoutes = new Hono<{ Bindings: Env }>();

// List all agents
agentRoutes.get('/', async (c) => {
  const hydrator = createHydrator(c.env);
  const agentIds = await hydrator.listWorkspaces();

  // Fetch basic info for each agent
  const agents = await Promise.all(
    agentIds.map(async (id) => {
      try {
        const ws = await hydrator.readWorkspace(id);
        return {
          agentId: id,
          lastModified: ws.lastModifiedEpochMs,
          files: Object.entries(ws.files)
            .filter(([_, v]) => v !== null)
            .map(([k]) => k),
        };
      } catch {
        return { agentId: id, lastModified: 0, files: [] };
      }
    }),
  );

  return c.json({ success: true, data: agents });
});

// Spawn a new sub-agent (used by Lead Agent)
agentRoutes.post('/spawn', async (c) => {
  const body = await c.req.json<{
    name: string;
    description?: string;
    soul?: string;
    identity?: string;
    tools?: string;
  }>();

  const agentId = `sub-${body.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

  const hydrator = createHydrator(c.env);

  // Write baseline files
  await hydrator.writeFile(
    agentId,
    'soul.md',
    body.soul ?? `# Soul\n\n## Purpose\nHelp the user accomplish their tasks.\n\n## Values\n- Accuracy - Provide correct, well-reasoned information\n- Helpfulness - Assist with whatever the user needs\n- Clarity - Communicate clearly and concisely\n`,
  );

  await hydrator.writeFile(
    agentId,
    'identity.md',
    body.identity ?? `# Identity\n\n**Name:** ${body.name}\n**Role:** AI Assistant\n**Type:** AGENT\n`,
  );

  await hydrator.writeFile(agentId, 'user.md', '# User Context\n\n*To be populated by the user during interaction.*\n');

  await hydrator.writeFile(agentId, 'memory.md', '# Memory\n\n*Agent created at ' + new Date().toISOString() + '*\n');

  await hydrator.writeFile(
    agentId,
    'tools.md',
    body.tools ?? '# Tools\n\n*No MCP tools assigned yet.*\n',
  );

  return c.json({
    success: true,
    data: {
      agentId,
      name: body.name,
      status: 'created',
      message: `Sub-agent "${body.name}" created successfully.`,
    },
  });
});

// Get agent diff log
agentRoutes.get('/:agentId/diff', async (c) => {
  const agentId = c.req.param('agentId');
  const hydrator = createHydrator(c.env);

  // For now, read current state. In production, compare with stored baseline.
  const workspace = await hydrator.readWorkspace(agentId);

  return c.json({
    success: true,
    data: {
      agentId,
      files: Object.entries(workspace.files).map(([name, content]) => ({
        name,
        size: content?.length ?? 0,
        modified: workspace.lastModifiedEpochMs,
      })),
    },
  });
});

// Delete agent
agentRoutes.delete('/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const hydrator = createHydrator(c.env);
  await hydrator.deleteWorkspace(agentId);
  return c.json({ success: true, data: { deleted: agentId } });
});

export { agentRoutes };
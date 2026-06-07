import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { ingressRouter } from './ingress-router.js';
import { workspaceRoutes } from './routes/workspace.js';
import { chatRoutes } from './routes/chat.js';
import { mcpRoutes } from './routes/mcp.js';
import { agentRoutes } from './routes/agents.js';
import { telegramRoutes } from './routes/telegram.js';
import type { Env } from '../worker-configuration.d.ts';

const app = new Hono<{ Bindings: Env }>();

// Global Middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:8081', 'https://*.pages.dev'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now(), version: '0.1.0' }));

// API Routes (all behind ingress router for auth)
app.use('/api/*', ingressRouter);
app.route('/api/workspaces', workspaceRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/mcp', mcpRoutes);
app.route('/api/agents', agentRoutes);

// Telegram webhook (no auth, verified by token)
app.route('/webhook/telegram', telegramRoutes);

// 404 fallback
app.notFound((c) => c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404));

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message || 'An unexpected error occurred',
      },
    },
    500,
  );
});

export default app;
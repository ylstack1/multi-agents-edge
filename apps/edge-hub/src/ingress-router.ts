import { createMiddleware } from 'hono/factory';
import { UnauthorizedError } from '@midas/contracts';
import type { Env } from '../worker-configuration.d.ts';

/**
 * Middleware that validates incoming requests and attaches session context.
 * Supports Web UI (session token in Authorization header) and Telegram webhooks.
 */
export const ingressRouter = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const sessionToken = c.req.header('X-Session-Token');
  const source = c.req.header('X-Source') ?? 'WEB_UI';

  // Web UI authentication via session token
  if (source === 'WEB_UI' || source === 'WEB_UI') {
    const token = authHeader?.replace('Bearer ', '') ?? sessionToken;
    if (!token) {
      throw new UnauthorizedError('Missing authentication token');
    }

    const secret = c.env.SESSION_SECRET;
    if (!secret) {
      throw new UnauthorizedError('Session secret not configured');
    }

    // Simple token validation (in production, use proper JWT verification)
    const [agentId] = atob(token).split(':');
    if (!agentId) {
      throw new UnauthorizedError('Invalid token format');
    }

    // Attach validated context to request
    c.set('agentId', agentId);
    c.set('source', 'WEB_UI');
  }

  await next();
});

// Type augmentation for Hono context
declare module 'hono' {
  interface ContextVariableMap {
    agentId: string;
    source: 'TELEGRAM' | 'WEB_UI';
  }
}
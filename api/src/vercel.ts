import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from './app';
import { ensureDB } from './config/db';

// Built once per warm function instance, reused across invocations.
const app = createApp();

/**
 * Vercel entry point (wrapped by api/index.js). The same Express app as
 * local dev, minus app.listen() and the in-process cron schedules.
 * /health skips the database so it stays useful for diagnosing a bad
 * MONGO_URI separately from a bad deploy.
 */
export async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (!req.url?.startsWith('/health')) {
      const uri = process.env.MONGO_URI;
      if (!uri) throw new Error('MONGO_URI is not set');
      await ensureDB(uri);
    }
    app(req, res);
  } catch (err) {
    console.error('[vercel] failed to prepare request', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Server failed to start. Check MONGO_URI and Atlas network access.' }));
  }
}

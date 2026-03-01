import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getEntries, subscribe, unsubscribe } from '../lib/logBuffer.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

/** Check if user is admin of at least one location */
async function isAnyAdmin(userId: string): Promise<boolean> {
  const result = await query(
    "SELECT 1 FROM location_members WHERE user_id = $1 AND role = 'admin' LIMIT 1",
    [userId],
  );
  return result.rows.length > 0;
}

// GET /api/admin/logs — return current buffer
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user || !(await isAnyAdmin(req.user.id))) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
      return;
    }

    const since = req.query.since ? Number.parseInt(req.query.since as string, 10) : undefined;
    const entries = getEntries(since);
    res.json({ results: entries, count: entries.length });
  }),
);

// GET /api/admin/logs/stream — SSE endpoint
router.get(
  '/stream',
  asyncHandler(async (req, res) => {
    if (!req.user || !(await isAnyAdmin(req.user.id))) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const onEntry = (entry: import('../lib/logBuffer.js').LogEntry) => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
      if (typeof (res as unknown as { flush?: () => void }).flush === 'function') {
        (res as unknown as { flush: () => void }).flush();
      }
    };

    subscribe(onEntry);

    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30_000);

    req.on('close', () => {
      clearInterval(keepalive);
      unsubscribe(onEntry);
    });
  }),
);

export default router;

import type { NextFunction, Request, Response } from 'express';
import { pushLog } from '../lib/logBuffer.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    // Skip the SSE stream endpoint itself to avoid log noise
    if (req.path === '/api/admin/logs/stream') return;

    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    pushLog({
      level,
      method: req.method,
      path: req.originalUrl,
      status,
      duration,
      ip: req.ip || req.socket.remoteAddress,
    });
  });

  next();
}

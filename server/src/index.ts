import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { query } from './db.js';
import { config } from './lib/config.js';
import { HttpError, OverLimitError, PlanRestrictedError } from './lib/httpErrors.js';
import { pushLog } from './lib/logBuffer.js';
import { createLogger } from './lib/logger.js';
import { apiLimiter, authLimiter, joinLimiter, planApiLimiter, registerLimiter, sensitiveAuthLimiter } from './lib/rateLimiters.js';
import { isRestoreInProgress } from './lib/restore.js';
import { tryAuthenticate } from './middleware/auth.js';
import { requestLogger } from './middleware/requestLogger.js';
import { requireActiveSubscription } from './middleware/requirePlan.js';
import activityRoutes from './routes/activity.js';
import { adminRoutes } from './routes/admin.js';
import aiRoutes from './routes/ai.js';
import { streamRouter as aiStreamRoutes } from './routes/aiStream.js';
import apiKeysRoutes from './routes/apiKeys.js';
import areasRoutes from './routes/areas.js';
import authRoutes from './routes/auth.js';
import avatarRoutes from './routes/avatar.js';
import { batchRoutes } from './routes/batch.js';
import binItemsRoutes from './routes/binItems.js';
import binPinsRoutes from './routes/binPins.js';
import { binSharesRoutes } from './routes/binShares.js';
import binsRoutes from './routes/bins.js';
import customFieldsRoutes from './routes/customFields.js';
import exportRoutes from './routes/export.js';
import itemsRoutes from './routes/items.js';
import locationsRoutes from './routes/locations.js';
import photosRoutes from './routes/photos.js';
import { planRoutes } from './routes/plan.js';
import printSettingsRoutes from './routes/printSettings.js';
import savedViewsRoutes from './routes/savedViews.js';
import scanHistoryRoutes from './routes/scanHistory.js';
import { sharedRoutes } from './routes/shared.js';
import { subscriptionsRoutes } from './routes/subscriptions.js';
import tagColorsRoutes from './routes/tagColors.js';
import tagsRoutes from './routes/tags.js';
import userPreferencesRoutes from './routes/userPreferences.js';

const STATIC_DIR = path.join(import.meta.dirname, '..', 'public');

export function createApp(): express.Express {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Compression (skip SSE streams — buffering breaks event delivery)
  app.use(compression({
    filter: (req, res) => {
      if (req.headers.accept === 'text/event-stream') return false;
      return compression.filter(req, res);
    },
  }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    if (config.frameAncestors) {
      res.setHeader('X-Frame-Options', `ALLOW-FROM ${config.frameAncestors.split(' ')[0]}`);
    } else {
      res.setHeader('X-Frame-Options', 'DENY');
    }
    if (config.trustProxy) {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    }
    // CSP hashes must match the inline scripts in index.html — update if those scripts change
    const frameAncestorsCsp = config.frameAncestors
      ? `frame-ancestors 'self' ${config.frameAncestors};`
      : "frame-ancestors 'none';";
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; ${frameAncestorsCsp} img-src 'self' data: blob:; script-src 'self' 'sha256-7KadoKzu1sd1+0LivMFrmxISBXbhj6nm/vOZqEaVC5I=' 'sha256-4kldY8Nv9iluY61Doo0WCNi1p1qCWgXWfSgXIX8g3g0='; style-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'self' blob:;`,
    );
    next();
  });

  app.use(cors({
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestLogger);

  // Health check (no auth, no rate limit)
  app.get('/api/health', async (_req, res) => {
    try {
      const result = await query<{ ok: number }>('SELECT 1 AS ok');
      if (result.rows[0]?.ok === 1) {
        res.json({ status: 'ok' });
      } else {
        res.status(503).json({ status: 'error', message: 'Database check failed' });
      }
    } catch {
      res.status(503).json({ status: 'error', message: 'Database unreachable' });
    }
  });

  // Block requests during restore
  app.use('/api', (_req, res, next) => {
    if (isRestoreInProgress()) {
      res.status(503).json({ error: 'SERVICE_UNAVAILABLE', message: 'Restore in progress' });
      return;
    }
    next();
  });

  // Routes
  app.use('/api', apiLimiter);
  app.use('/api', tryAuthenticate, requireActiveSubscription());
  app.use('/api', planApiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/demo-login', authLimiter);
  app.use('/api/auth/register', registerLimiter);
  app.use('/api/auth/invite-preview', joinLimiter);
  app.use('/api/auth/refresh', sensitiveAuthLimiter);
  app.use('/api/auth/password', sensitiveAuthLimiter);
  app.use('/api/auth/account', sensitiveAuthLimiter);
  app.use('/api/auth/forgot-password', sensitiveAuthLimiter);
  app.use('/api/auth/reset-password', sensitiveAuthLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/auth', avatarRoutes);
  app.use('/api/locations/join', joinLimiter);
  app.use('/api/locations', locationsRoutes);
  app.use('/api/locations', areasRoutes);
  app.use('/api/locations', activityRoutes);
  app.use('/api/locations', customFieldsRoutes);
  app.use('/api/bins', binPinsRoutes);
  app.use('/api/bins', binSharesRoutes);
  app.use('/api/bins', binsRoutes);
  app.use('/api/bins', binItemsRoutes);
  app.use('/api/photos', photosRoutes);
  app.use('/api/tag-colors', tagColorsRoutes);
  app.use('/api/print-settings', printSettingsRoutes);
  app.use('/api/user-preferences', userPreferencesRoutes);
  app.use('/api/saved-views', savedViewsRoutes);
  app.use('/api/scan-history', scanHistoryRoutes);
  app.use('/api/plan', planRoutes);
  app.use('/api/shared', sharedRoutes);
  app.use('/api/subscriptions', subscriptionsRoutes);
  app.use('/api', exportRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/ai', aiStreamRoutes);
  app.use('/api/api-keys', apiKeysRoutes);
  app.use('/api/tags', tagsRoutes);
  app.use('/api/items', itemsRoutes);
  app.use('/api', batchRoutes);
  app.use('/api/admin', adminRoutes);

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof PlanRestrictedError) {
      res.status(err.statusCode).json({
        error: err.code,
        message: err.message,
        upgrade_url: err.upgradeUrl,
      });
      return;
    }
    if (err instanceof OverLimitError) {
      res.status(err.statusCode).json({
        error: err.code,
        message: err.message,
        upgrade_url: err.upgradeUrl,
      });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
      res.status(422).json({ error: 'VALIDATION_ERROR', message });
      return;
    }
    const log = createLogger('http');
    pushLog({ level: 'error', message: `${err.name}: ${err.message}` });
    log.error(`${err.name}: ${err.message}`, err.stack);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  });

  // Catch-all for unmatched API routes
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint not found' });
  });

  // Static file serving (production — Vite output baked into Docker image)
  if (fs.existsSync(STATIC_DIR)) {
    // Hashed assets — immutable (Vite includes content hash in filenames)
    app.use('/assets', express.static(path.join(STATIC_DIR, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }));
    // Root files (index.html, manifest, SW) — always revalidate
    app.use(express.static(STATIC_DIR));

    // SPA fallback — send index.html for any unmatched GET
    app.get('*', (_req, res) => {
      res.sendFile(path.join(STATIC_DIR, 'index.html'));
    });
  }

  return app;
}

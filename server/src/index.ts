import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { config } from './lib/config.js';
import { authLimiter, registerLimiter, joinLimiter } from './lib/rateLimiters.js';
import authRoutes from './routes/auth.js';
import locationsRoutes from './routes/locations.js';
import areasRoutes from './routes/areas.js';
import binsRoutes from './routes/bins.js';
import binItemsRoutes from './routes/binItems.js';
import photosRoutes from './routes/photos.js';
import exportRoutes from './routes/export.js';
import tagColorsRoutes from './routes/tagColors.js';
import aiRoutes from './routes/ai.js';
import printSettingsRoutes from './routes/printSettings.js';
import userPreferencesRoutes from './routes/userPreferences.js';
import savedViewsRoutes from './routes/savedViews.js';
import scanHistoryRoutes from './routes/scanHistory.js';
import activityRoutes from './routes/activity.js';
import apiKeysRoutes from './routes/apiKeys.js';
import tagsRoutes from './routes/tags.js';
import itemsRoutes from './routes/items.js';
import { batchRoutes } from './routes/batch.js';
import { sensitiveAuthLimiter } from './lib/rateLimiters.js';
import { HttpError } from './lib/httpErrors.js';

const STATIC_DIR = path.join(import.meta.dirname, '..', 'public');

export function createApp(): express.Express {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Compression
  app.use(compression());

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    if (config.trustProxy) {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    }
    // CSP hashes must match the inline scripts in index.html — update if those scripts change
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob:; script-src 'self' 'sha256-7KadoKzu1sd1+0LivMFrmxISBXbhj6nm/vOZqEaVC5I=' 'sha256-4kldY8Nv9iluY61Doo0WCNi1p1qCWgXWfSgXIX8g3g0='; style-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'self' blob:;",
    );
    next();
  });

  app.use(cors({
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Routes
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', registerLimiter);
  app.use('/api/auth/refresh', sensitiveAuthLimiter);
  app.use('/api/auth/password', sensitiveAuthLimiter);
  app.use('/api/auth/account', sensitiveAuthLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/locations/join', joinLimiter);
  app.use('/api/locations', locationsRoutes);
  app.use('/api/locations', areasRoutes);
  app.use('/api/locations', activityRoutes);
  app.use('/api/bins', binsRoutes);
  app.use('/api/bins', binItemsRoutes);
  app.use('/api/photos', photosRoutes);
  app.use('/api/tag-colors', tagColorsRoutes);
  app.use('/api/print-settings', printSettingsRoutes);
  app.use('/api/user-preferences', userPreferencesRoutes);
  app.use('/api/saved-views', savedViewsRoutes);
  app.use('/api/scan-history', scanHistoryRoutes);
  app.use('/api', exportRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/api-keys', apiKeysRoutes);
  app.use('/api/tags', tagsRoutes);
  app.use('/api/items', itemsRoutes);
  app.use('/api', batchRoutes);

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    console.error(err.stack);
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

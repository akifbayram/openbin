import { getEngine } from './db/init.js';
import { initialize } from './db.js';
import { createApp } from './index.js';
import { startBackupScheduler, stopBackupScheduler } from './lib/backup.js';
import { config } from './lib/config.js';
import { seedDemoData } from './lib/demoSeed.js';
import { loadEmailTemplates } from './lib/emailTemplateLoader.js';
import { pushLog } from './lib/logBuffer.js';
import { createLogger } from './lib/logger.js';
import { cleanupOrphanPhotos } from './lib/photoCleanup.js';
import { purgeExpiredRefreshTokens } from './lib/refreshTokens.js';
import { closeThumbnailPool } from './lib/thumbnailPool.js';

const log = createLogger('startup');

// Initialize the database engine before anything touches the DB
await initialize();
loadEmailTemplates();

let eeModule: typeof import('./ee/index.js') | null = null;
if (!config.selfHosted) {
  eeModule = await import('./ee/index.js');
  eeModule.registerHooks();
}

// Load persisted maintenance mode state
import('./middleware/maintenance.js').then(m => m.loadMaintenanceMode()).catch(() => {});

const app = createApp({
  mountEeRoutes: eeModule ? (a) => eeModule.initEeRoutes(a) : undefined,
});

if (config.disableRateLimit && process.env.NODE_ENV !== 'test') {
  log.warn('Rate limiting is disabled (DISABLE_RATE_LIMIT=true)');
}
if (!config.selfHosted && !config.subscriptionJwtSecret) {
  log.warn('SUBSCRIPTION_JWT_SECRET is not set — Manager webhooks and upgrade URLs are disabled');
}
if (!config.selfHosted && !config.managerUrl) {
  log.warn('Cloud mode is active but MANAGER_URL is not set');
}
if (!config.selfHosted && !config.trustProxy) {
  log.warn('TRUST_PROXY is false in cloud mode — rate limiting and IP detection will not work behind a reverse proxy');
}

if (config.demoMode) {
  seedDemoData().catch((err) => log.error('Demo seed failed:', err instanceof Error ? err.message : err));
}

// Track timer handles for cleanup during shutdown
const timers: { timeouts: NodeJS.Timeout[]; intervals: NodeJS.Timeout[] } = { timeouts: [], intervals: [] };

const server = app.listen(config.port, () => {
  log.info(`API server listening on port ${config.port}`);
  pushLog({ level: 'info', message: `Server started on port ${config.port}` });
  startBackupScheduler();

  // Purge expired refresh tokens on startup and every 24 hours
  purgeExpiredRefreshTokens().catch((err) => log.error('Token purge failed:', err instanceof Error ? err.message : err));
  timers.intervals.push(
    setInterval(() => purgeExpiredRefreshTokens().catch((err) => log.error('Token purge failed:', err instanceof Error ? err.message : err)), 24 * 60 * 60 * 1000),
  );

  eeModule?.startEeJobs();

  // Orphan photo cleanup — 30s after startup, then every 6 hours
  timers.timeouts.push(setTimeout(() => {
    cleanupOrphanPhotos().catch(() => {});
    timers.intervals.push(
      setInterval(() => cleanupOrphanPhotos().catch(() => {}), 6 * 60 * 60 * 1000),
    );
  }, 30_000));
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

const shutdown = () => {
  log.info('Shutting down gracefully...');
  server.close(() => {
    // Stop all scheduled jobs
    stopBackupScheduler();
    eeModule?.stopEeJobs();
    for (const id of timers.timeouts) clearTimeout(id);
    for (const id of timers.intervals) clearInterval(id);

    // Drain thumbnail worker pool, then close the database connection
    closeThumbnailPool()
      .catch(() => {})
      .finally(() => getEngine().close().catch(() => {}));

    log.info('Shutdown complete');
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    log.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

import { initialize } from './db.js';
import { createApp } from './index.js';
import { startBackupScheduler } from './lib/backup.js';
import { config } from './lib/config.js';
import { seedDemoData } from './lib/demoSeed.js';
import { pushLog } from './lib/logBuffer.js';
import { createLogger } from './lib/logger.js';
import { cleanupOrphanPhotos } from './lib/photoCleanup.js';
import { purgeExpiredRefreshTokens } from './lib/refreshTokens.js';
import { startTrialChecker } from './lib/trialChecker.js';
import { startUserCleanupJob } from './lib/userCleanup.js';
import { startWebhookOutboxProcessor } from './lib/webhookOutbox.js';

const log = createLogger('startup');

// Initialize the database engine before anything touches the DB
await initialize();

const app = createApp();

if (!config.aiEncryptionKey) {
  log.warn('AI_ENCRYPTION_KEY is not set — AI API keys will be stored in plaintext');
}
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

app.listen(config.port, () => {
  log.info(`API server listening on port ${config.port}`);
  pushLog({ level: 'info', message: `Server started on port ${config.port}` });
  startBackupScheduler();

  // Purge expired refresh tokens on startup and every 24 hours
  purgeExpiredRefreshTokens().catch((err) => log.error('Token purge failed:', err instanceof Error ? err.message : err));
  setInterval(() => purgeExpiredRefreshTokens().catch((err) => log.error('Token purge failed:', err instanceof Error ? err.message : err)), 24 * 60 * 60 * 1000);

  startTrialChecker();
  startUserCleanupJob();
  startWebhookOutboxProcessor();

  // Orphan photo cleanup — 30s after startup, then every 6 hours
  setTimeout(() => {
    cleanupOrphanPhotos().catch(() => {});
    setInterval(() => cleanupOrphanPhotos().catch(() => {}), 6 * 60 * 60 * 1000);
  }, 30_000);
});

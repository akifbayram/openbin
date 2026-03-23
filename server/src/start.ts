import { createApp } from './index.js';
import { startBackupScheduler } from './lib/backup.js';
import { config } from './lib/config.js';
import { seedDemoData } from './lib/demoSeed.js';
import { pushLog } from './lib/logBuffer.js';
import { cleanupOrphanPhotos } from './lib/photoCleanup.js';
import { purgeExpiredRefreshTokens } from './lib/refreshTokens.js';

const app = createApp();

if (!config.aiEncryptionKey) {
  console.warn('WARNING: AI_ENCRYPTION_KEY is not set — AI API keys will be stored in plaintext');
}
if (config.disableRateLimit && process.env.NODE_ENV !== 'test') {
  console.warn('WARNING: Rate limiting is disabled (DISABLE_RATE_LIMIT=true)');
}

if (config.demoMode) {
  seedDemoData();
}

app.listen(config.port, () => {
  console.log(`API server listening on port ${config.port}`);
  pushLog({ level: 'info', message: `Server started on port ${config.port}` });
  startBackupScheduler();

  // Purge expired refresh tokens on startup and every 24 hours
  purgeExpiredRefreshTokens().catch(() => {});
  setInterval(() => purgeExpiredRefreshTokens().catch(() => {}), 24 * 60 * 60 * 1000);

  // Orphan photo cleanup — 30s after startup, then every 6 hours
  setTimeout(() => {
    cleanupOrphanPhotos();
    setInterval(() => cleanupOrphanPhotos(), 6 * 60 * 60 * 1000);
  }, 30_000);
});

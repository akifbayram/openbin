import { createApp } from './index.js';
import { startBackupScheduler } from './lib/backup.js';
import { config } from './lib/config.js';
import { seedDemoData } from './lib/demoSeed.js';
import { pushLog } from './lib/logBuffer.js';
import { purgeExpiredRefreshTokens } from './lib/refreshTokens.js';

const app = createApp();

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
});

import { createApp } from './index.js';
import { config } from './lib/config.js';
import { startBackupScheduler } from './lib/backup.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`API server listening on port ${config.port}`);
  startBackupScheduler();
});

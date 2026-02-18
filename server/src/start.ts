import { createApp } from './index.js';
import { startBackupScheduler } from './lib/backup.js';

const app = createApp();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
  startBackupScheduler();
});

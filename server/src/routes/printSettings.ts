import { createSettingsRouter } from '../lib/settingsRouteFactory.js';

const router = createSettingsRouter({
  table: 'user_print_settings',
  label: 'print settings',
});

export default router;

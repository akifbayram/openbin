import { createSettingsRouter } from '../lib/settingsRouteFactory.js';

const router = createSettingsRouter({
  table: 'user_preferences',
  label: 'user preferences',
});

export default router;

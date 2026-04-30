import type express from 'express';
import { registerEeHooks } from '../lib/eeHooks.js';
import { startInactivityChecker, stopInactivityChecker } from './inactivityChecker.js';
import { deleteUserData, notifyManagerNewUser, notifyManagerUserUpdate } from './managerWebhook.js';
import { adminMetricsRoutes } from './routes/adminMetrics.js';
import { adminOverridesRoutes } from './routes/adminOverrides.js';
import { subscriptionsRoutes } from './routes/subscriptions.js';
import { startTrialChecker, stopTrialChecker } from './trialChecker.js';
import { startWebhookOutboxProcessor, stopWebhookOutboxProcessor } from './webhookOutbox.js';

export function registerHooks(): void {
  registerEeHooks({
    onNewUser: notifyManagerNewUser,
    onUserUpdate: notifyManagerUserUpdate,
    onDeleteUser: deleteUserData,
    // Reap EE-only tables inside the userCleanup hard-delete transaction.
    // Lives in EE so the table names (email_log, ai_usage, bin_shares) are
    // not referenced from lib/userCleanup.ts when BUILD_EDITION != cloud.
    onHardDeleteUser: async (tx, userId) => {
      await tx('DELETE FROM email_log WHERE user_id = $1', [userId]);
      await tx('DELETE FROM ai_usage WHERE user_id = $1', [userId]);
      await tx('DELETE FROM bin_shares WHERE created_by = $1', [userId]);
    },
  });
}

export function initEeRoutes(app: express.Express): void {
  app.use('/api/subscriptions', subscriptionsRoutes);
  app.use('/api/admin', adminMetricsRoutes);
  app.use('/api/admin/overrides', adminOverridesRoutes);
}

export function startEeJobs(): void {
  // user cleanup is started unconditionally from start.ts (lib, both editions)
  startTrialChecker();
  startWebhookOutboxProcessor();
  startInactivityChecker();
}

export function stopEeJobs(): void {
  stopTrialChecker();
  stopWebhookOutboxProcessor();
  stopInactivityChecker();
}

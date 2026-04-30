import type express from 'express';
import { query } from '../db.js';
import { registerEeHooks } from '../lib/eeHooks.js';
import { createLogger } from '../lib/logger.js';
import { cancelSubscription, deleteBillingCustomer } from './billingClient.js';
import { startInactivityChecker, stopInactivityChecker } from './inactivityChecker.js';
import {
  fireDeletionCompletedEmail,
  fireDeletionRecoveredEmail,
  fireDeletionRequestedEmail,
} from './lifecycleEmails.js';
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
    cancelSubscription,
    deleteBillingCustomer,
    notifyDeletionScheduled: async (userId, scheduledAt, hadActiveSubscription, refundAmountCents) => {
      // The hook signature doesn't carry email/displayName; look them up
      // from the DB. The user row still exists during the grace period.
      const userResult = await query<{ email: string | null; display_name: string | null }>(
        'SELECT email, display_name FROM users WHERE id = $1',
        [userId],
      );
      const user = userResult.rows[0];
      if (user?.email) {
        fireDeletionRequestedEmail(
          userId,
          user.email,
          user.display_name ?? user.email,
          scheduledAt,
          hadActiveSubscription,
          refundAmountCents,
        );
      } else {
        deletionLog.warn(`notifyDeletionScheduled: no email on file for user ${userId}`);
      }
    },
    notifyDeletionRecovered: async (userId, email, displayName) => {
      fireDeletionRecoveredEmail(userId, email, displayName);
    },
    notifyDeletionCompleted: async (userId, email, displayName) => {
      fireDeletionCompletedEmail(userId, email, displayName);
    },
  });
}

const deletionLog = createLogger('deletionEmails');

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

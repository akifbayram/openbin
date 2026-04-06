import type express from 'express';
import { registerEeHooks } from '../lib/eeHooks.js';
import { deleteUserData, notifyManagerNewUser, notifyManagerUserUpdate } from './managerWebhook.js';
import { adminMetricsRoutes } from './routes/adminMetrics.js';
import { subscriptionsRoutes } from './routes/subscriptions.js';
import { startTrialChecker, stopTrialChecker } from './trialChecker.js';
import { startUserCleanupJob, stopUserCleanupJob } from './userCleanup.js';
import { startWebhookOutboxProcessor, stopWebhookOutboxProcessor } from './webhookOutbox.js';

export function registerHooks(): void {
  registerEeHooks({
    onNewUser: notifyManagerNewUser,
    onUserUpdate: notifyManagerUserUpdate,
    onDeleteUser: deleteUserData,
  });
}

export function initEeRoutes(app: express.Express): void {
  app.use('/api/subscriptions', subscriptionsRoutes);
  app.use('/api/admin', adminMetricsRoutes);
}

export function startEeJobs(): void {
  startTrialChecker();
  startWebhookOutboxProcessor();
  startUserCleanupJob();
}

export function stopEeJobs(): void {
  stopTrialChecker();
  stopWebhookOutboxProcessor();
  stopUserCleanupJob();
}

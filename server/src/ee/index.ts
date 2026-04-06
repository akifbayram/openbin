import type express from 'express';
import { registerEeHooks } from '../lib/eeHooks.js';
import { deleteUserData, notifyManagerNewUser, notifyManagerUserUpdate } from './managerWebhook.js';
import { subscriptionsRoutes } from './routes/subscriptions.js';
import { startTrialChecker, stopTrialChecker } from './trialChecker.js';
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
}

export function startEeJobs(): void {
  startTrialChecker();
  startWebhookOutboxProcessor();
}

export function stopEeJobs(): void {
  stopTrialChecker();
  stopWebhookOutboxProcessor();
}

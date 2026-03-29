import { getDb } from '../db.js';
import { config } from './config.js';
import { enqueueWebhook } from './webhookOutbox.js';

function sendManagerRequest(endpoint: string, payload: Record<string, unknown>, errorTag: string): void {
  if (!config.managerUrl || config.selfHosted) return;
  if (!config.subscriptionJwtSecret) {
    console.warn(`[managerWebhook] ${errorTag}: SUBSCRIPTION_JWT_SECRET not set, skipping`);
    return;
  }
  enqueueWebhook(endpoint, payload);
}

interface NewUserPayload {
  userId: string;
  email: string | null;
  username: string;
  activeUntil: string;
  status: string;
}

export function notifyManagerNewUser(user: NewUserPayload): void {
  sendManagerRequest('/api/v1/users', {
    userId: user.userId,
    email: user.email,
    username: user.username,
    activeUntil: user.activeUntil,
    status: user.status,
    action: 'create_user',
  }, 'Failed to notify Manager of new user');
}

interface UserUpdatePayload {
  userId: string;
  action: 'update_subscription' | 'delete_user';
  plan?: number;
  status?: number;
  activeUntil?: string | null;
}

export function notifyManagerUserUpdate(payload: UserUpdatePayload): void {
  sendManagerRequest('/api/v1/users/update', { ...payload }, `Failed to notify Manager (${payload.action})`);
}

export function deleteUserData(userId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM api_key_daily_usage WHERE api_key_id IN (SELECT id FROM api_keys WHERE user_id = ?)').run(userId);
  db.prepare('DELETE FROM api_keys WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM email_log WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM ai_usage WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM bin_shares WHERE created_by = ?').run(userId);
}

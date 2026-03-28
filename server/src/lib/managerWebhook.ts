import jwt from 'jsonwebtoken';
import { config } from './config.js';

interface NewUserPayload {
  userId: string;
  email: string | null;
  username: string;
  activeUntil: string;
  status: string;
}

export function notifyManagerNewUser(user: NewUserPayload): void {
  if (!config.managerUrl || config.selfHosted) return;

  const secret = config.subscriptionJwtSecret ?? config.jwtSecret;
  const token = jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      username: user.username,
      activeUntil: user.activeUntil,
      status: user.status,
      action: 'create_user',
    },
    secret,
    { algorithm: 'HS256', expiresIn: '5m' },
  );

  fetch(`${config.managerUrl}/api/v1/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }).catch((err) => {
    console.error('[managerWebhook] Failed to notify Manager of new user:', err);
  });
}

import { Router } from 'express';
import * as jose from 'jose';
import { query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { UnauthorizedError } from '../lib/httpErrors.js';
import { createLogger } from '../lib/logger.js';
import { getSubscriptionSecretKey } from '../lib/planGate.js';

const log = createLogger('internalApi');
const router = Router();

const ISSUER = 'openbin-manager';
const AUDIENCE = 'openbin-backend';

async function verifyManagerJwt(authHeader: string | undefined): Promise<void> {
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError('Missing token');
  const token = authHeader.slice(7);
  try {
    await jose.jwtVerify(token, getSubscriptionSecretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      requiredClaims: ['exp', 'iat', 'jti'],
    });
  } catch (err) {
    log.warn(`internal jwt verify failed: ${err instanceof Error ? err.message : String(err)}`);
    throw new UnauthorizedError('Invalid token');
  }
}

// GET /api/v1/users/:userId/exists — returns { exists: bool }
// Used by the billing service's orphan reconciliation job to detect
// customer records whose qrcode user no longer exists (eg. account
// deletion that succeeded locally but failed to notify billing).
// JWT-authed (issuer=openbin-manager, audience=openbin-backend) — same
// shape as the existing /api/subscriptions/callback endpoint.
router.get(
  '/users/:userId/exists',
  asyncHandler(async (req, res) => {
    if (config.selfHosted) {
      res.status(404).json({ error: 'NOT_AVAILABLE' });
      return;
    }
    await verifyManagerJwt(req.headers.authorization);
    const result = await query<{ id: string }>(
      'SELECT id FROM users WHERE id = $1',
      [req.params.userId],
    );
    res.json({ exists: result.rows.length > 0 });
  }),
);

export { router as internalRoutes };

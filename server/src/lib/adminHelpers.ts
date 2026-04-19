import { query } from '../db.js';
import { NotFoundError } from './httpErrors.js';

export async function getAdminCount(): Promise<number> {
  const result = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM users WHERE is_admin = TRUE');
  return result.rows[0].cnt;
}

export async function assertUserExists(userId: string): Promise<{ id: string; email: string }> {
  const result = await query<{ id: string; email: string }>(
    'SELECT id, email FROM users WHERE id = $1',
    [userId],
  );
  if (result.rows.length === 0) throw new NotFoundError('User not found');
  return result.rows[0];
}

export const VALID_ROLES = ['admin', 'member', 'viewer'] as const;
type LocationRole = (typeof VALID_ROLES)[number];

export function isValidRole(role: unknown): role is LocationRole {
  return typeof role === 'string' && (VALID_ROLES as readonly string[]).includes(role);
}

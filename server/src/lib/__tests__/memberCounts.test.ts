import { beforeEach, describe, expect, it } from 'vitest';
import { generateUuid, query } from '../../db.js';
import { countNonViewerMembers } from '../memberCounts.js';

describe('countNonViewerMembers', () => {
  let locationId: string;

  beforeEach(async () => {
    locationId = generateUuid();
    const userId = generateUuid();
    await query(
      `INSERT INTO users (id, password_hash, display_name, email)
       VALUES ($1, 'h', 'u', $2)`,
      [userId, `u-${userId}@test`],
    );
    await query(
      `INSERT INTO locations (id, name, created_by, invite_code) VALUES ($1, 'L', $2, $3)`,
      [locationId, userId, `code-${locationId}`],
    );
  });

  async function addMember(role: 'admin' | 'member' | 'viewer'): Promise<void> {
    const userId = generateUuid();
    await query(
      `INSERT INTO users (id, password_hash, display_name, email)
       VALUES ($1, 'h', 'u', $2)`,
      [userId, `u-${userId}@test`],
    );
    await query(
      `INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)`,
      [generateUuid(), locationId, userId, role],
    );
  }

  it('returns 0 for a location with no members', async () => {
    expect(await countNonViewerMembers(locationId)).toBe(0);
  });

  it('counts admins and members, not viewers', async () => {
    await addMember('admin');
    await addMember('member');
    await addMember('viewer');
    await addMember('viewer');
    expect(await countNonViewerMembers(locationId)).toBe(2);
  });

  it('returns 0 when only viewers exist', async () => {
    await addMember('viewer');
    await addMember('viewer');
    expect(await countNonViewerMembers(locationId)).toBe(0);
  });
});

import type { Express } from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
import { generateUuid, query } from '../db.js';
import { createApp } from '../index.js';
import { findOrCreateOAuthUser, generateUsername } from '../lib/oauth.js';
import { createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('generateUsername', () => {
  it('extracts prefix from email', async () => {
    const name = await generateUsername('jane.doe@gmail.com');
    expect(name).toBe('janedoe');
  });

  it('strips non-alphanumeric/underscore chars', async () => {
    const name = await generateUsername('j+a.n-e@example.com');
    expect(name).toBe('jane');
  });

  it('truncates to 50 chars', async () => {
    const long = `${'a'.repeat(60)}@example.com`;
    const name = await generateUsername(long);
    expect(name.length).toBeLessThanOrEqual(50);
  });

  it('appends numeric suffix on conflict', async () => {
    await createTestUser(app, { username: 'testconflict' });
    const name = await generateUsername('testconflict@example.com');
    expect(name).toBe('testconflict2');
  });

  it('increments suffix until unique', async () => {
    await createTestUser(app, { username: 'dupuser' });
    await query(
      "INSERT INTO users (id, username, password_hash, display_name, plan, sub_status) VALUES ($1, $2, $3, $4, 1, 1)",
      [generateUuid(), 'dupuser2', 'hash', 'dup']
    );
    const name = await generateUsername('dupuser@example.com');
    expect(name).toBe('dupuser3');
  });

  it('falls back to "user" for empty prefix', async () => {
    const name = await generateUsername('@example.com');
    expect(name).toBe('user');
  });
});

describe('findOrCreateOAuthUser', () => {
  it('creates new user when no match exists', async () => {
    const result = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-123',
      email: 'newuser@example.com',
      displayName: 'New User',
    });
    expect(result.user.username).toBeTruthy();
    expect(result.created).toBe(true);
  });

  it('returns existing user when oauth link exists', async () => {
    const first = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-456',
      email: 'existing@example.com',
      displayName: 'Existing',
    });
    const second = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-456',
      email: 'existing@example.com',
      displayName: 'Existing',
    });
    expect(second.user.id).toBe(first.user.id);
    expect(second.created).toBe(false);
  });

  it('auto-links when email matches existing password user', async () => {
    const { user } = await createTestUser(app, { email: 'link@example.com' });
    const result = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-789',
      email: 'link@example.com',
      displayName: 'Linked',
    });
    expect(result.user.id).toBe(user.id);
    expect(result.created).toBe(false);
  });

  it('rejects suspended user', async () => {
    const result = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-suspend',
      email: 'suspended@example.com',
      displayName: 'Suspended',
    });
    await query("UPDATE users SET suspended_at = datetime('now') WHERE id = $1", [result.user.id]);
    await expect(
      findOrCreateOAuthUser({
        provider: 'google',
        providerUserId: 'google-sub-suspend',
        email: 'suspended@example.com',
        displayName: 'Suspended',
      })
    ).rejects.toThrow();
  });
});

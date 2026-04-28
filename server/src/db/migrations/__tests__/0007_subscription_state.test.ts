import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { subscriptionState } from '../0007_subscription_state.js';

describe('migration 0007_subscription_state', () => {
  it('adds cancel_at_period_end + billing_period columns to users (sqlite)', () => {
    const db = new Database(':memory:');
    db.prepare('CREATE TABLE users (id TEXT PRIMARY KEY, plan INTEGER, sub_status INTEGER)').run();

    subscriptionState.sqlite!(db);

    const cols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string; type: string }>;
    expect(cols.find(c => c.name === 'cancel_at_period_end')).toBeDefined();
    expect(cols.find(c => c.name === 'billing_period')).toBeDefined();
  });

  it('is idempotent (sqlite re-run does not throw)', () => {
    const db = new Database(':memory:');
    db.prepare('CREATE TABLE users (id TEXT PRIMARY KEY, plan INTEGER, sub_status INTEGER)').run();

    subscriptionState.sqlite!(db);
    expect(() => subscriptionState.sqlite!(db)).not.toThrow();
  });
});

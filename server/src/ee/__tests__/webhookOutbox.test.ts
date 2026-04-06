import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
const mockGenerateUuid = vi.fn().mockReturnValue('test-uuid-1');

vi.mock('../../db.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  generateUuid: () => mockGenerateUuid(),
}));
vi.mock('../../lib/config.js', () => ({ config: { selfHosted: true, managerUrl: '' } }));
vi.mock('../../lib/jobLock.js', () => ({
  acquireJobLock: vi.fn().mockReturnValue(true),
  releaseJobLock: vi.fn(),
}));
vi.mock('../../lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

const { enqueueWebhook, startWebhookOutboxProcessor, stopWebhookOutboxProcessor } = await import('../webhookOutbox.js');

describe('webhookOutbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateUuid.mockReturnValue('test-uuid-1');
  });

  it('enqueueWebhook inserts a row into webhook_outbox', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    enqueueWebhook('/test', { foo: 'bar' });
    // enqueueWebhook is fire-and-forget; wait for the promise to resolve
    await vi.waitFor(() => expect(mockQuery).toHaveBeenCalledTimes(1));
    expect(mockQuery).toHaveBeenCalledWith(
      'INSERT INTO webhook_outbox (id, endpoint, payload_json) VALUES ($1, $2, $3)',
      ['test-uuid-1', '/test', '{"foo":"bar"}'],
    );
  });

  it('enqueueWebhook stores endpoint and JSON payload', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const payload = { event: 'user.created', userId: '123' };
    enqueueWebhook('/webhooks/notify', payload);
    await vi.waitFor(() => expect(mockQuery).toHaveBeenCalledTimes(1));
    const args = mockQuery.mock.calls[0];
    expect(args[1][1]).toBe('/webhooks/notify');
    expect(JSON.parse(args[1][2])).toEqual(payload);
  });

  it('multiple enqueues create rows with distinct IDs', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    mockGenerateUuid
      .mockReturnValueOnce('aaa-111')
      .mockReturnValueOnce('bbb-222')
      .mockReturnValueOnce('ccc-333');
    enqueueWebhook('/a', { n: 1 });
    enqueueWebhook('/b', { n: 2 });
    enqueueWebhook('/c', { n: 3 });
    await vi.waitFor(() => expect(mockQuery).toHaveBeenCalledTimes(3));
    const ids = mockQuery.mock.calls.map((c: unknown[][]) => c[1][0]);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual(['aaa-111', 'bbb-222', 'ccc-333']);
    // Each call inserts exactly 3 bind params (id, endpoint, payload_json)
    for (const call of mockQuery.mock.calls) {
      expect(call[1]).toHaveLength(3);
    }
  });

  it('startWebhookOutboxProcessor is a no-op in self-hosted mode', () => {
    expect(() => startWebhookOutboxProcessor()).not.toThrow();
  });

  it('stopWebhookOutboxProcessor is safe to call without starting', () => {
    expect(() => stopWebhookOutboxProcessor()).not.toThrow();
  });
});

describe('webhookOutbox – DB-level SQL verification', () => {
  /**
   * These tests verify the SQL statements that processOutbox() would run.
   * Since processOutbox is not exported and the processor is a no-op in
   * self-hosted mode, we validate the SQL shapes against a real in-memory
   * SQLite database to confirm schema compatibility.
   */

  let Database: typeof import('better-sqlite3');
  let db: import('better-sqlite3').Database;

  beforeEach(async () => {
    Database = (await import('better-sqlite3')).default;
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE webhook_outbox (
        id            TEXT PRIMARY KEY,
        endpoint      TEXT NOT NULL,
        payload_json  TEXT NOT NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        sent_at       TEXT,
        attempts      INTEGER NOT NULL DEFAULT 0,
        last_error    TEXT,
        next_retry_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  });

  it('new row has sent_at = NULL and attempts = 0', () => {
    db.prepare('INSERT INTO webhook_outbox (id, endpoint, payload_json) VALUES (?, ?, ?)').run(
      'id-1', '/test', '{"a":1}',
    );
    const row = db.prepare('SELECT sent_at, attempts, next_retry_at, created_at FROM webhook_outbox WHERE id = ?').get('id-1') as {
      sent_at: string | null; attempts: number; next_retry_at: string; created_at: string;
    };
    expect(row.sent_at).toBeNull();
    expect(row.attempts).toBe(0);
    expect(row.next_retry_at).toBeTruthy();
    expect(row.created_at).toBeTruthy();
  });

  it('next_retry_at defaults to approximately now (ready for immediate processing)', () => {
    db.prepare('INSERT INTO webhook_outbox (id, endpoint, payload_json) VALUES (?, ?, ?)').run(
      'id-2', '/ep', '{}',
    );
    const rows = db.prepare(
      `SELECT id FROM webhook_outbox WHERE sent_at IS NULL AND next_retry_at <= datetime('now')`,
    ).all() as { id: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('id-2');
  });

  it('abandonment SQL marks entries older than 48 hours', () => {
    db.prepare(
      `INSERT INTO webhook_outbox (id, endpoint, payload_json, created_at, next_retry_at)
       VALUES (?, ?, ?, datetime('now', '-49 hours'), datetime('now'))`,
    ).run('old-1', '/old', '{}');
    db.prepare('INSERT INTO webhook_outbox (id, endpoint, payload_json) VALUES (?, ?, ?)').run(
      'new-1', '/new', '{}',
    );

    const maxAgeSeconds = 48 * 60 * 60;
    db.prepare(
      `UPDATE webhook_outbox SET last_error = 'ABANDONED', sent_at = datetime('now')
       WHERE sent_at IS NULL AND created_at < datetime('now', '-' || ? || ' seconds')`,
    ).run(maxAgeSeconds);

    const old = db.prepare('SELECT sent_at, last_error FROM webhook_outbox WHERE id = ?').get('old-1') as {
      sent_at: string | null; last_error: string | null;
    };
    const fresh = db.prepare('SELECT sent_at, last_error FROM webhook_outbox WHERE id = ?').get('new-1') as {
      sent_at: string | null; last_error: string | null;
    };

    expect(old.sent_at).not.toBeNull();
    expect(old.last_error).toBe('ABANDONED');
    expect(fresh.sent_at).toBeNull();
    expect(fresh.last_error).toBeNull();
  });

  it('purge SQL removes entries older than 7 days', () => {
    db.prepare(
      `INSERT INTO webhook_outbox (id, endpoint, payload_json, created_at, next_retry_at)
       VALUES (?, ?, ?, datetime('now', '-8 days'), datetime('now'))`,
    ).run('ancient-1', '/ancient', '{}');
    db.prepare('INSERT INTO webhook_outbox (id, endpoint, payload_json) VALUES (?, ?, ?)').run(
      'recent-1', '/recent', '{}',
    );

    db.prepare(
      "DELETE FROM webhook_outbox WHERE created_at < datetime('now', '-' || ? || ' days')",
    ).run(7);

    const all = db.prepare('SELECT id FROM webhook_outbox').all() as { id: string }[];
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('recent-1');
  });

  it('purge does not remove entries younger than 7 days', () => {
    db.prepare(
      `INSERT INTO webhook_outbox (id, endpoint, payload_json, created_at, next_retry_at)
       VALUES (?, ?, ?, datetime('now', '-6 days'), datetime('now'))`,
    ).run('six-days', '/ep', '{}');

    db.prepare(
      "DELETE FROM webhook_outbox WHERE created_at < datetime('now', '-' || ? || ' days')",
    ).run(7);

    const remaining = db.prepare('SELECT id FROM webhook_outbox').all() as { id: string }[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('six-days');
  });

  it('abandonment does not touch already-sent entries', () => {
    db.prepare(
      `INSERT INTO webhook_outbox (id, endpoint, payload_json, created_at, sent_at, next_retry_at)
       VALUES (?, ?, ?, datetime('now', '-49 hours'), datetime('now', '-1 hour'), datetime('now'))`,
    ).run('sent-old', '/ep', '{}');

    const maxAgeSeconds = 48 * 60 * 60;
    db.prepare(
      `UPDATE webhook_outbox SET last_error = 'ABANDONED', sent_at = datetime('now')
       WHERE sent_at IS NULL AND created_at < datetime('now', '-' || ? || ' seconds')`,
    ).run(maxAgeSeconds);

    const row = db.prepare('SELECT last_error FROM webhook_outbox WHERE id = ?').get('sent-old') as {
      last_error: string | null;
    };
    expect(row.last_error).toBeNull();
  });
});

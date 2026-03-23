import type Database from 'better-sqlite3';
import { getDb } from '../db.js';
import { config } from './config.js';

let stmtRecord: Database.Statement | null = null;
let stmtGet: Database.Statement | null = null;

function getRecordStmt(): Database.Statement {
  if (!stmtRecord) {
    stmtRecord = getDb().prepare(`
      INSERT INTO ai_usage (user_id, call_count)
      VALUES (?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET call_count = call_count + excluded.call_count
    `);
  }
  return stmtRecord;
}

function getGetStmt(): Database.Statement {
  if (!stmtGet) {
    stmtGet = getDb().prepare(
      "SELECT call_count FROM ai_usage WHERE user_id = ? AND date = date('now')",
    );
  }
  return stmtGet;
}

/** Upsert daily AI usage for a user, incrementing call_count by `count`. */
export function recordAiUsage(userId: string, count: number): void {
  getRecordStmt().run(userId, count);
}

/** Return today's total AI call count for a user (0 if none). */
export function getDailyUsage(userId: string): number {
  const row = getGetStmt().get(userId) as { call_count: number } | undefined;
  return row?.call_count ?? 0;
}

/** Check whether a demo user can spend `requestedCount` more AI tokens today. */
export function checkDailyBudget(userId: string, requestedCount: number): { allowed: boolean; remaining: number; limit: number } {
  const limit = config.demoAiDailyBudget;
  const used = getDailyUsage(userId);
  const remaining = Math.max(0, limit - used);
  return { allowed: remaining >= requestedCount, remaining, limit };
}

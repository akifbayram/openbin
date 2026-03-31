import { d, query } from '../db.js';
import { config } from './config.js';

/** Upsert daily AI usage for a user, incrementing call_count by `count`. */
export async function recordAiUsage(userId: string, count: number): Promise<void> {
  await query(
    `INSERT INTO ai_usage (user_id, call_count) VALUES ($1, $2)
     ON CONFLICT(user_id, date) DO UPDATE SET call_count = call_count + excluded.call_count`,
    [userId, count],
  );
}

/** Return today's total AI call count for a user (0 if none). */
export async function getDailyUsage(userId: string): Promise<number> {
  const result = await query<{ call_count: number }>(
    `SELECT call_count FROM ai_usage WHERE user_id = $1 AND date = ${d.today()}`,
    [userId],
  );
  return result.rows[0]?.call_count ?? 0;
}

/** Check whether a demo user can spend `requestedCount` more AI tokens today. */
export async function checkDailyBudget(
  userId: string,
  requestedCount: number,
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const limit = config.demoAiDailyBudget;
  const used = await getDailyUsage(userId);
  const remaining = Math.max(0, limit - used);
  return { allowed: remaining >= requestedCount, remaining, limit };
}

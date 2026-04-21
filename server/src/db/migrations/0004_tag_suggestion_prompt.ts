import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

function addColumnIfNotExists(db: Database.Database, stmt: string): void {
  try {
    db.exec(stmt);
  } catch (err) {
    if (err instanceof Error && err.message.includes('duplicate column name')) return;
    throw err;
  }
}

export const tagSuggestionPrompt: Migration = {
  name: '0004_tag_suggestion_prompt',
  sqlite(db) {
    addColumnIfNotExists(db, 'ALTER TABLE user_ai_settings ADD COLUMN tag_suggestion_prompt TEXT');
  },
  async postgres(pool) {
    await pool.query('ALTER TABLE user_ai_settings ADD COLUMN IF NOT EXISTS tag_suggestion_prompt TEXT');
  },
};

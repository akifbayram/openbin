import type Database from 'better-sqlite3';
import type pg from 'pg';

export interface Migration {
	/** Unique name, e.g. '0001_legacy'. Sorted lexicographically to determine run order. */
	name: string;
	/** Run on SQLite databases. Receives the raw better-sqlite3 handle. */
	sqlite?: (db: Database.Database) => void;
	/** Run on PostgreSQL databases. Receives the pg Pool. */
	postgres?: (pool: pg.Pool) => Promise<void>;
}

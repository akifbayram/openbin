import { legacy } from './0001_legacy.js';
import type { Migration } from './types.js';

/**
 * Ordered list of all migrations. The runner processes these in array order.
 * New migrations are appended here.
 */
export const migrations: Migration[] = [
  legacy,
];

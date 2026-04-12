import { legacy } from './0001_legacy.js';
import { shareExpires } from './0002_share_expires.js';
import { binUsageDays } from './0003_bin_usage_days.js';
import type { Migration } from './types.js';

/**
 * Ordered list of all migrations. The runner processes these in array order.
 * New migrations are appended here.
 */
export const migrations: Migration[] = [
  legacy,
  shareExpires,
  binUsageDays,
];

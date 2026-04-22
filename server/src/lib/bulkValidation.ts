import { config } from './config.js';
import { SelectionTooLargeError, ValidationError } from './httpErrors.js';

/** Validate an ids array: must be a non-empty array of unique strings within the cap. */
export function validateBulkIds(ids: unknown, fieldName = 'ids'): string[] {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty array`);
  }
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new ValidationError(`${fieldName} must contain non-empty strings`);
    }
  }
  if (ids.length > config.bulkMaxSelection) {
    throw new SelectionTooLargeError(config.bulkMaxSelection, ids.length);
  }
  // Dedup while preserving order
  return [...new Set(ids as string[])];
}

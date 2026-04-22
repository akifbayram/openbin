import { describe, expect, it } from 'vitest';
import { validateBulkIds } from '../bulkValidation.js';
import { SelectionTooLargeError, ValidationError } from '../httpErrors.js';

describe('validateBulkIds', () => {
  it('returns ids unchanged for valid input', () => {
    expect(validateBulkIds(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });
  it('dedups duplicates', () => {
    expect(validateBulkIds(['a', 'b', 'a'])).toEqual(['a', 'b']);
  });
  it('throws ValidationError on empty array', () => {
    expect(() => validateBulkIds([])).toThrow(ValidationError);
  });
  it('throws ValidationError on non-array', () => {
    expect(() => validateBulkIds('a')).toThrow(ValidationError);
  });
  it('throws ValidationError on non-string entry', () => {
    expect(() => validateBulkIds(['a', 1])).toThrow(ValidationError);
  });
  it('throws SelectionTooLargeError above cap', () => {
    const big = Array.from({ length: 201 }, (_, i) => `id-${i}`);
    expect(() => validateBulkIds(big)).toThrow(SelectionTooLargeError);
  });
});

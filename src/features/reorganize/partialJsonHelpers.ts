/**
 * Shared helpers for streaming JSON parsers in the reorganize feature.
 * Both `parsePartialReorg` and `parsePartialTagProposal` consume partial/incomplete
 * JSON text and need the same primitives for unescaping strings and scanning
 * brace-delimited object regions while correctly skipping over string content.
 */

/** Matches a JSON-quoted string with escape handling: "...". */
export const QUOTED_STRING = /"((?:[^"\\]|\\.)*)"/g;

/** Decode \" → " and \\ → \ in a JSON-extracted substring. */
export function unescapeString(s: string): string {
  return s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

/**
 * Scan forward from `startIdx` inside `text`, tracking brace depth, and return
 * the index of the closing `}` that matches the opening `{` the caller already
 * consumed (depth starts at 1, meaning "we're inside one open object").
 *
 * Correctly skips over JSON string content (e.g. names containing `{` or `}`).
 * Returns -1 if the object is not yet closed within `text` (streaming case).
 */
export function findObjectEnd(text: string, startIdx: number): number {
  let depth = 1;
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    } else if (ch === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i++;
        i++;
      }
    }
  }
  return -1;
}

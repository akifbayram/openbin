export interface PartialReorgBin {
  name: string;
  items: string[];
  tags: string[];
}

export interface PartialReorgResult {
  bins: PartialReorgBin[];
  summary: string;
}

/** Extract completed bins and summary from a partial JSON stream of { bins: [...], summary: "..." }. */
const TAGS_PATTERN = /"tags"\s*:\s*\[([^\]]*)\]/;
const QUOTED_STRING = /"((?:[^"\\]|\\.)*)"/g;

/** Find the index of the closing `}` for a bin object starting after `startIdx` in `text`. */
function findBinObjectEnd(text: string, startIdx: number): number {
  let depth = 1;
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function parsePartialReorg(text: string): PartialReorgResult {
  const bins: PartialReorgBin[] = [];
  let summary = '';

  // Extract summary if present
  const summaryMatch = text.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch) summary = summaryMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');

  // Find the bins array
  const binsStart = text.indexOf('"bins"');
  if (binsStart === -1) return { bins, summary };

  const bracketStart = text.indexOf('[', binsStart);
  if (bracketStart === -1) return { bins, summary };

  const afterBracket = text.slice(bracketStart + 1);

  // Extract each bin object: find {"name": "...", "items": [...]}
  const binPattern = /\{\s*"name"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"items"\s*:\s*\[/g;
  for (const match of afterBracket.matchAll(binPattern)) {
    const name = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const items: string[] = [];

    const itemsStart = match.index + match[0].length;
    const remaining = afterBracket.slice(itemsStart);

    const closeBracket = remaining.indexOf(']');
    const region = closeBracket !== -1 ? remaining.slice(0, closeBracket) : remaining;

    // Match complete quoted strings
    for (const itemMatch of region.matchAll(QUOTED_STRING)) {
      items.push(itemMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
    }

    // If no closing bracket, check for a trailing partial string: "value (no closing quote)
    if (closeBracket === -1) {
      const trailingMatch = region.match(/"((?:[^"\\]|\\.)*)$/);
      if (trailingMatch) {
        const partial = trailingMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        if (partial) items.push(partial);
      }
    }

    // Extract tags array if present — scoped to the current bin object only
    const tags: string[] = [];
    if (closeBracket !== -1) {
      const afterItemsOffset = itemsStart + closeBracket + 1;
      // Find the closing brace of this bin object to scope the search
      const binEnd = findBinObjectEnd(afterBracket, match.index + 1);
      const searchEnd = binEnd !== -1 ? binEnd : afterBracket.length;
      const binRemainder = afterBracket.slice(afterItemsOffset, searchEnd);
      const tagsMatch = binRemainder.match(TAGS_PATTERN);
      if (tagsMatch) {
        for (const tagMatch of tagsMatch[1].matchAll(QUOTED_STRING)) {
          tags.push(tagMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
        }
      }
    }

    bins.push({ name, items, tags });
  }

  return { bins, summary };
}

export interface PartialAnalysis {
  name: string;
  items: string[];
}

/** Extract completed `name` and `items` from a partial JSON stream of `{ name, items, ... }`. */
export function parsePartialAnalysis(text: string): PartialAnalysis {
  let name = '';
  const items: string[] = [];

  // Match "name": "..."  (handles escaped quotes inside the value)
  const nameMatch = text.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (nameMatch) name = nameMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');

  // Find the items array opening
  const itemsStart = text.indexOf('"items"');
  if (itemsStart === -1) return { name, items };

  const bracketStart = text.indexOf('[', itemsStart);
  if (bracketStart === -1) return { name, items };

  // Extract the items array region
  const afterBracket = text.slice(bracketStart + 1);
  const bracketEnd = afterBracket.indexOf(']');
  const region = bracketEnd !== -1 ? afterBracket.slice(0, bracketEnd) : afterBracket;

  // Handle both old format ["item1", "item2"] and new format [{"name": "item1", ...}, ...]
  if (region.includes('{')) {
    // Object format: extract "name" values from each item object
    const namePattern = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    for (const match of region.matchAll(namePattern)) {
      items.push(match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
    }
  } else {
    // String format: extract quoted strings
    const itemPattern = /"((?:[^"\\]|\\.)*)"/g;
    for (const match of region.matchAll(itemPattern)) {
      items.push(match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
    }
  }

  return { name, items };
}

/** Number of complete items in a partial JSON analysis stream. */
export function parseAnalysisItemCount(text: string): number {
  return parsePartialAnalysis(text).items.length;
}

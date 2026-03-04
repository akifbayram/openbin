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

  // Extract all complete quoted strings from the items array region
  const afterBracket = text.slice(bracketStart + 1);
  const bracketEnd = afterBracket.indexOf(']');
  const region = bracketEnd !== -1 ? afterBracket.slice(0, bracketEnd) : afterBracket;

  const itemPattern = /"((?:[^"\\]|\\.)*)"/g;
  for (const match of region.matchAll(itemPattern)) {
    items.push(match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  }

  return { name, items };
}

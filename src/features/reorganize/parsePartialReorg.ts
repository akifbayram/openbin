export interface PartialReorgBin {
  name: string;
  items: string[];
}

export interface PartialReorgResult {
  bins: PartialReorgBin[];
  summary: string;
}

/** Extract completed bins and summary from a partial JSON stream of { bins: [...], summary: "..." }. */
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
  let match: RegExpExecArray | null;
  while ((match = binPattern.exec(afterBracket)) !== null) {
    const name = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const items: string[] = [];

    const itemsStart = match.index + match[0].length;
    const remaining = afterBracket.slice(itemsStart);

    const closeBracket = remaining.indexOf(']');
    const region = closeBracket !== -1 ? remaining.slice(0, closeBracket) : remaining;

    // Match complete quoted strings
    const itemPattern = /"((?:[^"\\]|\\.)*)"/g;
    for (const itemMatch of region.matchAll(itemPattern)) {
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

    bins.push({ name, items });
  }

  return { bins, summary };
}

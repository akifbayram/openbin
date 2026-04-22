import { findObjectEnd, QUOTED_STRING, unescapeString } from './partialJsonHelpers';
import type { PartialReorgBinIndexed, PartialReorgResultIndexed } from './resolveReorgIndexes';

const TAGS_PATTERN = /"tags"\s*:\s*\[([^\]]*)\]/;
/** Matches a complete integer (possibly negative) only when followed by `,` or `]`. */
const DELIMITED_INTEGER = /(-?\d+)\s*(?=[,\]])/g;

export function parsePartialReorg(text: string): PartialReorgResultIndexed {
  const bins: PartialReorgBinIndexed[] = [];

  const binsStart = text.indexOf('"bins"');
  if (binsStart === -1) return { bins };

  const bracketStart = text.indexOf('[', binsStart);
  if (bracketStart === -1) return { bins };

  const afterBracket = text.slice(bracketStart + 1);

  const binPattern = /\{\s*"name"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"items"\s*:\s*\[/g;
  for (const match of afterBracket.matchAll(binPattern)) {
    const name = unescapeString(match[1]);
    const itemsStart = match.index + match[0].length;
    const remaining = afterBracket.slice(itemsStart);

    const closeBracket = remaining.indexOf(']');
    const region = closeBracket !== -1 ? remaining.slice(0, closeBracket + 1) : remaining;

    const itemIndices: number[] = [];
    for (const m of region.matchAll(DELIMITED_INTEGER)) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) itemIndices.push(n);
    }

    const tags: string[] = [];
    if (closeBracket !== -1) {
      const afterItemsOffset = itemsStart + closeBracket + 1;
      const binEnd = findObjectEnd(afterBracket, match.index + 1);
      const searchEnd = binEnd !== -1 ? binEnd : afterBracket.length;
      const binRemainder = afterBracket.slice(afterItemsOffset, searchEnd);
      const tagsMatch = binRemainder.match(TAGS_PATTERN);
      if (tagsMatch) {
        for (const tagMatch of tagsMatch[1].matchAll(QUOTED_STRING)) {
          tags.push(unescapeString(tagMatch[1]));
        }
      }
    }

    bins.push({ name, itemIndices, tags });
  }

  return { bins };
}

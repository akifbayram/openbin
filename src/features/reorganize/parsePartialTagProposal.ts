export interface PartialTagTaxonomy {
  newTags: Array<{ tag: string; parent?: string }>;
  renames: Array<{ from: string; to: string }>;
  merges: Array<{ from: string[]; to: string }>;
  parents: Array<{ tag: string; parent: string }>;
}

export interface PartialTagAssignment {
  binId: string;
  add: string[];
  remove: string[];
}

export interface PartialTagProposal {
  taxonomy: PartialTagTaxonomy;
  assignments: PartialTagAssignment[];
  summary: string;
}

const QUOTED = /"((?:[^"\\]|\\.)*)"/g;

function unescapeString(s: string): string {
  return s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function extractStringField(text: string, field: string): string | null {
  const m = text.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? unescapeString(m[1]) : null;
}

function findObjectStrings(region: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < region.length; i++) {
    const ch = region[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        results.push(region.slice(start, i + 1));
        start = -1;
      }
    } else if (ch === '"') {
      i += 1;
      while (i < region.length && region[i] !== '"') {
        if (region[i] === '\\') i += 1;
        i += 1;
      }
    }
  }
  // If there's an unclosed object at the end, include it
  if (start !== -1) {
    results.push(region.slice(start));
  }
  return results;
}

function parseArray(text: string, field: string): string | null {
  const start = text.indexOf(`"${field}"`);
  if (start === -1) return null;
  const bracket = text.indexOf('[', start);
  if (bracket === -1) return null;
  let depth = 0;
  for (let i = bracket; i < text.length; i++) {
    if (text[i] === '[') depth += 1;
    else if (text[i] === ']') {
      depth -= 1;
      if (depth === 0) return text.slice(bracket + 1, i);
    } else if (text[i] === '"') {
      i += 1;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i += 1;
        i += 1;
      }
    }
  }
  // Return partial content if array is unclosed
  return text.slice(bracket + 1);
}

function parseStringArrayRegion(region: string): string[] {
  const out: string[] = [];
  for (const m of region.matchAll(QUOTED)) out.push(unescapeString(m[1]));
  return out;
}

function parseNewTags(region: string): Array<{ tag: string; parent?: string }> {
  return findObjectStrings(region)
    .map((obj) => {
      const tag = extractStringField(obj, 'tag') ?? '';
      const parent = extractStringField(obj, 'parent');
      return parent ? { tag, parent } : { tag };
    })
    .filter((e) => e.tag);
}

function parseRenames(region: string): Array<{ from: string; to: string }> {
  return findObjectStrings(region)
    .map((obj) => {
      const from = extractStringField(obj, 'from') ?? '';
      const to = extractStringField(obj, 'to') ?? '';
      return { from, to };
    })
    .filter((e) => e.from && e.to);
}

function parseMerges(region: string): Array<{ from: string[]; to: string }> {
  return findObjectStrings(region)
    .map((obj) => {
      const fromArr = parseArray(obj, 'from');
      const from = fromArr ? parseStringArrayRegion(fromArr) : [];
      const to = extractStringField(obj, 'to') ?? '';
      return { from, to };
    })
    .filter((e) => e.from.length > 0 && e.to);
}

function parseParents(region: string): Array<{ tag: string; parent: string }> {
  return findObjectStrings(region)
    .map((obj) => {
      const tag = extractStringField(obj, 'tag') ?? '';
      const parent = extractStringField(obj, 'parent') ?? '';
      return { tag, parent };
    })
    .filter((e) => e.tag && e.parent);
}

function parseAssignments(region: string): PartialTagAssignment[] {
  return findObjectStrings(region)
    .map((obj) => {
      const binId = extractStringField(obj, 'binId') ?? '';
      const addArr = parseArray(obj, 'add');
      const removeArr = parseArray(obj, 'remove');
      return {
        binId,
        add: addArr ? parseStringArrayRegion(addArr) : [],
        remove: removeArr ? parseStringArrayRegion(removeArr) : [],
      };
    })
    .filter((e) => e.binId);
}

export function parsePartialTagProposal(text: string): PartialTagProposal {
  const taxonomyStart = text.indexOf('"taxonomy"');
  let taxonomyRegion = '';
  if (taxonomyStart !== -1) {
    const brace = text.indexOf('{', taxonomyStart);
    if (brace !== -1) {
      let depth = 0;
      let end = text.length;
      for (let i = brace; i < text.length; i++) {
        if (text[i] === '{') depth += 1;
        else if (text[i] === '}') {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        } else if (text[i] === '"') {
          i += 1;
          while (i < text.length && text[i] !== '"') {
            if (text[i] === '\\') i += 1;
            i += 1;
          }
        }
      }
      taxonomyRegion = text.slice(brace, end + 1);
    }
  }

  return {
    taxonomy: {
      newTags: parseNewTags(parseArray(taxonomyRegion, 'newTags') ?? ''),
      renames: parseRenames(parseArray(taxonomyRegion, 'renames') ?? ''),
      merges: parseMerges(parseArray(taxonomyRegion, 'merges') ?? ''),
      parents: parseParents(parseArray(taxonomyRegion, 'parents') ?? ''),
    },
    assignments: parseAssignments(parseArray(text, 'assignments') ?? ''),
    summary: extractStringField(text, 'summary') ?? '',
  };
}

# Parent/Child Tag Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add single-level parent/child tag hierarchy with implicit inheritance for filtering, so filtering by a parent tag includes bins with any of its child tags.

**Architecture:** Extend existing `tag_colors` table with a `parent_tag` column. Server validates single-level depth. Client uses `tagParents` Map from extended context. TagInput shows grouped dropdown; TagTableView shows inline tree.

**Tech Stack:** React 18, TypeScript, Express 4, SQLite/PostgreSQL, Vitest

**Spec:** `docs/superpowers/specs/2026-04-05-parent-child-tags-design.md`

---

## File Structure

All modifications to existing files — no new files.

| File | Responsibility |
|------|---------------|
| `server/schema.sqlite.sql` | Add `parent_tag` column to `tag_colors` CREATE TABLE |
| `server/schema.pg.sql` | Same for PostgreSQL |
| `server/openapi.yaml` | Update TagColor schema and request/response docs |
| `server/src/routes/tagColors.ts` | Extend PUT to accept `parentTag`, validate hierarchy, extend GET to return `parent_tag` |
| `server/src/routes/tags.ts` | Extend GET to include `parent_tag` via JOIN + UNION edge case, cascade rename/delete |
| `server/src/lib/binQueries.ts` | Expand parent tags to include children in filter queries |
| `src/types.ts` | Add `parent_tag` to `TagColor` interface |
| `src/features/tags/useTagColors.ts` | Return `tagParents` Map alongside `tagColors` |
| `src/features/tags/TagColorsContext.tsx` | Expose `tagParents` in context |
| `src/features/tags/CreateTagDialog.tsx` | Add parent dropdown below color picker |
| `src/features/bins/TagInput.tsx` | Group tags by parent in browse mode; show parent hint in search mode |
| `src/features/tags/TagTableView.tsx` | Inline tree with collapse/expand, indented children |
| `src/features/tags/TagsPage.tsx` | "Set Parent" dialog, "Add Child Tag" action, delete cascade toast |

---

### Task 1: Schema & Type Changes

**Files:**
- Modify: `server/schema.sqlite.sql:100-108`
- Modify: `server/schema.pg.sql:111-119`
- Modify: `server/openapi.yaml:653-684`
- Modify: `src/types.ts:133-140`

- [ ] **Step 1: Add `parent_tag` column to SQLite schema**

In `server/schema.sqlite.sql`, find the `tag_colors` CREATE TABLE (line ~100) and add `parent_tag` before `created_at`:

```sql
CREATE TABLE IF NOT EXISTS tag_colors (
  id            TEXT PRIMARY KEY,
  location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tag           TEXT NOT NULL,
  color         TEXT NOT NULL,
  parent_tag    TEXT DEFAULT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(location_id, tag)
);
```

- [ ] **Step 2: Add `parent_tag` column to PostgreSQL schema**

In `server/schema.pg.sql`, same change to the `tag_colors` CREATE TABLE:

```sql
CREATE TABLE IF NOT EXISTS tag_colors (
  id            TEXT PRIMARY KEY,
  location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tag           TEXT NOT NULL,
  color         TEXT NOT NULL,
  parent_tag    TEXT DEFAULT NULL,
  created_at    TEXT DEFAULT (NOW()),
  updated_at    TEXT DEFAULT (NOW()),
  UNIQUE(location_id, tag)
);
```

- [ ] **Step 3: Update `TagColor` TypeScript interface**

In `src/types.ts`, add `parent_tag` to the `TagColor` interface:

```typescript
export interface TagColor {
  id: string;
  location_id: string;
  tag: string;
  color: string;
  parent_tag: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Update OpenAPI spec**

In `server/openapi.yaml`, add `parent_tag` to the `TagColor` schema (after `color`):

```yaml
    parent_tag:
      type: string
      nullable: true
      description: Parent tag name for hierarchy (single-level only)
```

And add `parentTag` to the `TagColorRequest` schema (optional field):

```yaml
    parentTag:
      type: string
      nullable: true
      description: Parent tag name (null or empty to clear)
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add server/schema.sqlite.sql server/schema.pg.sql src/types.ts server/openapi.yaml
git commit -m "feat: add parent_tag column to tag_colors schema and types"
```

---

### Task 2: Server — Extend Tag Colors API

**Files:**
- Modify: `server/src/routes/tagColors.ts`

- [ ] **Step 1: Extend GET to return `parent_tag`**

In `server/src/routes/tagColors.ts`, update the SELECT query in the GET handler (line ~25) to include `parent_tag`:

```sql
SELECT id, location_id, tag, color, parent_tag, created_at, updated_at
FROM tag_colors
WHERE location_id = $1
ORDER BY tag ${d.nocase()}
```

- [ ] **Step 2: Extend PUT to accept and validate `parentTag`**

In the PUT handler (line ~33), add `parentTag` extraction from the request body and validation logic. The full updated handler:

```typescript
router.put('/', asyncHandler(async (req, res) => {
  const { locationId, tag, color, parentTag } = req.body;
  if (!locationId || !tag) throw new ValidationError('locationId and tag are required');
  await requireMemberOrAbove(req, locationId);

  const trimmedTag = tag.trim().toLowerCase();
  const trimmedParent = parentTag?.trim().toLowerCase() || null;

  // Validate color if provided and non-empty
  if (color && !HEX_COLOR_REGEX.test(color) && !COLOR_KEY_REGEX.test(color)) {
    throw new ValidationError('Invalid color format');
  }

  // Validate parent hierarchy constraints
  if (trimmedParent) {
    if (trimmedParent === trimmedTag) {
      throw new ValidationError('A tag cannot be its own parent');
    }
    // Parent must not itself be a child
    const parentEntry = query<{ parent_tag: string | null }>(
      `SELECT parent_tag FROM tag_colors WHERE location_id = $1 AND tag = $2`,
      [locationId, trimmedParent],
    );
    if (parentEntry.length > 0 && parentEntry[0].parent_tag) {
      throw new ValidationError('Cannot set a child tag as parent (single-level hierarchy)');
    }
    // Tag must not already have children
    const children = query<{ tag: string }>(
      `SELECT tag FROM tag_colors WHERE location_id = $1 AND parent_tag = $2`,
      [locationId, trimmedTag],
    );
    if (children.length > 0) {
      throw new ValidationError('Cannot set parent on a tag that already has children');
    }
  }

  const effectiveColor = color || '';

  // If color is empty and no parentTag, delete the entry
  if (!effectiveColor && !trimmedParent) {
    query(
      `DELETE FROM tag_colors WHERE location_id = $1 AND tag = $2`,
      [locationId, trimmedTag],
    );
    return res.json({ deleted: true });
  }

  const id = generateUuid();
  const rows = query<Record<string, unknown>>(
    `INSERT INTO tag_colors (id, location_id, tag, color, parent_tag)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (location_id, tag) DO UPDATE
       SET color = $4, parent_tag = $5, updated_at = ${d.now()}
     RETURNING id, location_id, tag, color, parent_tag, created_at, updated_at`,
    [id, locationId, trimmedTag, effectiveColor, trimmedParent],
  );
  res.json(rows[0]);
}));
```

- [ ] **Step 3: Verify server type-checks**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/tagColors.ts
git commit -m "feat: extend tag-colors API to handle parent_tag"
```

---

### Task 3: Server — Extend Tags API (GET, Rename, Delete Cascade)

**Files:**
- Modify: `server/src/routes/tags.ts`

- [ ] **Step 1: Extend GET `/api/tags` to include `parent_tag` and UNION parent tags with 0 bins**

The current query aggregates tags from `bins.tags` via `json_each`. We wrap it with a LEFT JOIN to tag_colors for `parent_tag`, and UNION in parent tags that have children but no bin usage.

Replace the base query construction (lines ~35-42) and the data/count queries with:

```typescript
// Base CTE: tags from bins + parent-only tags from tag_colors
const binTagsQuery = `
  SELECT jt.value AS tag, COUNT(DISTINCT b.id) AS count
  FROM bins b, ${d.jsonEachFrom('b.tags', 'jt')}
  WHERE b.location_id = $1
    AND b.deleted_at IS NULL
    AND (b.visibility = 'location' OR b.created_by = $2)
  GROUP BY jt.value
  ${havingClause}`;

const parentOnlyQuery = `
  SELECT DISTINCT tc_p.parent_tag AS tag, 0 AS count
  FROM tag_colors tc_p
  WHERE tc_p.location_id = $1
    AND tc_p.parent_tag IS NOT NULL
    ${searchParam ? `AND tc_p.parent_tag LIKE $${params.length}` : ''}
    AND tc_p.parent_tag NOT IN (
      SELECT jt2.value FROM bins b2, ${d.jsonEachFrom('b2.tags', 'jt2')}
      WHERE b2.location_id = $1 AND b2.deleted_at IS NULL
    )`;

const baseQuery = `
  SELECT t.tag, t.count, tc.parent_tag
  FROM (${binTagsQuery} UNION ALL ${parentOnlyQuery}) t
  LEFT JOIN tag_colors tc ON tc.tag = t.tag AND tc.location_id = $1`;
```

Update the count query:
```typescript
const countQuery = `SELECT COUNT(*) AS total FROM (${binTagsQuery} UNION ALL ${parentOnlyQuery}) t`;
```

Update the data query to ORDER BY and LIMIT on the outer query:
```typescript
const dataQuery = `${baseQuery} ORDER BY ${orderBy} LIMIT ... OFFSET ...`;
```

The response shape changes from `{ tag, count }` to `{ tag, count, parent_tag }`.

- [ ] **Step 2: Add `parent_tag` cascade to rename handler**

In the PUT `/api/tags/rename` handler (after the existing tag_colors UPDATE at line ~110), add:

```typescript
// Update parent_tag references in children
query(
  `UPDATE tag_colors SET parent_tag = $1, updated_at = ${d.now()}
   WHERE location_id = $2 AND parent_tag = $3`,
  [trimmed, locationId, oldTag],
);
```

- [ ] **Step 3: Add `parent_tag` orphan on delete handler**

In the DELETE `/api/tags/:tag` handler, BEFORE the existing `DELETE FROM tag_colors` (line ~152), add:

```typescript
// Orphan children — set their parent_tag to NULL
const orphaned = query<{ tag: string }>(
  `UPDATE tag_colors SET parent_tag = NULL, updated_at = ${d.now()}
   WHERE location_id = $1 AND parent_tag = $2
   RETURNING tag`,
  [locationId, tag],
);
```

Then update the response to include orphan count:

```typescript
res.json({ deleted: true, binsUpdated: updated.length, orphanedChildren: orphaned.length });
```

- [ ] **Step 4: Verify server type-checks**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/tags.ts
git commit -m "feat: extend tags API with parent_tag in GET, cascade on rename/delete"
```

---

### Task 4: Server — Expand Parent Tags in Bin Filter

**Files:**
- Modify: `server/src/lib/binQueries.ts:72-87`

- [ ] **Step 1: Modify tag filter to expand parent tags**

In `server/src/lib/binQueries.ts`, replace the multi-tag filter block (lines 72-87). For each tag in the filter, expand to also match children of that tag via a subquery:

```typescript
const tagList = filters.tags ? filters.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
if (tagList.length > 0) {
  // Build expanded tag set: each tag + its children from tag_colors
  const expandedClauses: string[] = [];
  for (const t of tagList) {
    const p = `$${paramIdx}`;
    expandedClauses.push(
      `(value = ${p} OR value IN (SELECT tag FROM tag_colors WHERE parent_tag = ${p} AND location_id = $1))`,
    );
    params.push(t);
    paramIdx++;
  }
  if (filters.tagMode === 'all') {
    // Each expanded clause must match at least one bin tag
    const allClauses = expandedClauses.map(
      (clause) => `EXISTS (SELECT 1 FROM ${d.jsonEach('b.tags')} WHERE ${clause})`,
    );
    whereClauses.push(`(${allClauses.join(' AND ')})`);
  } else {
    // Any expanded clause matches
    const anyClauses = expandedClauses.map(
      (clause) => `EXISTS (SELECT 1 FROM ${d.jsonEach('b.tags')} WHERE ${clause})`,
    );
    whereClauses.push(`(${anyClauses.join(' OR ')})`);
  }
} else if (filters.tag?.trim()) {
  const p = `$${paramIdx}`;
  whereClauses.push(
    `EXISTS (SELECT 1 FROM ${d.jsonEach('b.tags')} WHERE value = ${p} OR value IN (SELECT tag FROM tag_colors WHERE parent_tag = ${p} AND location_id = $1))`,
  );
  params.push(filters.tag.trim());
  paramIdx++;
}
```

Note: `$1` is always `location_id` (it's the first param pushed by the calling code in binQueries.ts — verify this by checking the surrounding code).

- [ ] **Step 2: Verify server type-checks and tests**

Run: `cd server && npx tsc --noEmit && npx vitest run`
Expected: No type errors. Existing tests pass (filter expansion is additive — no parent tags in test data means no behavior change).

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/binQueries.ts
git commit -m "feat: expand parent tags to include children in bin filter queries"
```

---

### Task 5: Client — Hooks & Context

**Files:**
- Modify: `src/features/tags/useTagColors.ts`
- Modify: `src/features/tags/TagColorsContext.tsx`

- [ ] **Step 1: Extend `useTagColors` to return `tagParents` Map**

In `src/features/tags/useTagColors.ts`, update the hook to build both `tagColors` and `tagParents` maps:

```typescript
export function useTagColors() {
  const { activeLocationId, token } = useAuth();
  const { data: rawTagColors, isLoading } = useListData<TagColor>(
    token && activeLocationId
      ? `/api/tag-colors?location_id=${encodeURIComponent(activeLocationId)}`
      : null,
    [Events.TAG_COLORS],
  );

  const tagColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const tc of rawTagColors) {
      if (tc.color) map.set(tc.tag, tc.color);
    }
    return map;
  }, [rawTagColors]);

  const tagParents = useMemo(() => {
    const map = new Map<string, string>();
    for (const tc of rawTagColors) {
      if (tc.parent_tag) map.set(tc.tag, tc.parent_tag);
    }
    return map;
  }, [rawTagColors]);

  return { tagColors, tagParents, isLoading };
}
```

Also add a new exported mutation function:

```typescript
export async function setTagParent(locationId: string, tag: string, parentTag: string | null): Promise<void> {
  // Get existing color so we don't clobber it
  await apiFetch('/api/tag-colors', {
    method: 'PUT',
    body: { locationId, tag, color: '', parentTag: parentTag || null },
  });
  notifyTagColorsChanged();
}
```

Wait — this would overwrite the color with ''. The PUT endpoint needs to handle partial updates. Let me reconsider.

Actually, looking at the PUT handler I wrote in Task 2, it accepts both `color` and `parentTag`. If color is '' and parentTag is set, it creates a row with `color = ''` and `parent_tag = value`. If we want to set parent without changing color, we need to send the current color. Let me add a helper that fetches the current color first, or modify the server to allow partial updates.

The simplest fix: make the server's PUT smarter. If color is not in the body, preserve the existing color. Let me update the plan.

Actually, let me reconsider the server PUT. The current design replaces both color and parent_tag on every PUT. For `setTagParent`, the client should send the existing color to preserve it. The hook can handle this:

```typescript
export async function setTagParent(locationId: string, tag: string, parentTag: string | null, currentColor: string): Promise<void> {
  await apiFetch('/api/tag-colors', {
    method: 'PUT',
    body: { locationId, tag, color: currentColor, parentTag: parentTag || null },
  });
  notifyTagColorsChanged();
}
```

The caller passes the current color from `tagColors.get(tag) || ''`.

- [ ] **Step 2: Extend `TagColorsContext` to expose `tagParents`**

In `src/features/tags/TagColorsContext.tsx`:

```typescript
import { createContext, useContext } from 'react';
import { useTagColors } from './useTagColors';

interface TagColorsContextValue {
  tagColors: Map<string, string>;
  tagParents: Map<string, string>;
  isLoading: boolean;
}

const TagColorsContext = createContext<TagColorsContextValue>({
  tagColors: new Map(),
  tagParents: new Map(),
  isLoading: false,
});

export function TagColorsProvider({ children }: { children: React.ReactNode }) {
  const { tagColors, tagParents, isLoading } = useTagColors();
  return (
    <TagColorsContext.Provider value={{ tagColors, tagParents, isLoading }}>
      {children}
    </TagColorsContext.Provider>
  );
}

export function useTagColorsContext() {
  return useContext(TagColorsContext);
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/features/tags/useTagColors.ts src/features/tags/TagColorsContext.tsx
git commit -m "feat: extend useTagColors and context to expose tagParents map"
```

---

### Task 6: Client — CreateTagDialog Parent Picker

**Files:**
- Modify: `src/features/tags/CreateTagDialog.tsx`

- [ ] **Step 1: Add parent dropdown to CreateTagDialog**

Update props to accept `suggestions` (all tag names), `tagParents`, and optional `defaultParent`:

```typescript
interface CreateTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tagName: string;
  onConfirm: () => void;
  suggestions?: string[];
  tagParents?: Map<string, string>;
  defaultParent?: string | null;
}
```

Add parent state and compute parent-eligible tags:

```typescript
const [parent, setParent] = useState<string>('');

useEffect(() => {
  if (open) {
    setColor('');
    setParent(defaultParent || '');
  }
}, [open, defaultParent]);

// Parent-eligible: tags that are NOT children of another tag
const parentOptions = useMemo(() => {
  if (!suggestions || !tagParents) return [];
  return suggestions.filter((t) => !tagParents.has(t) && t !== tagName);
}, [suggestions, tagParents, tagName]);
```

Update `handleConfirm` to also set parent:

```typescript
function handleConfirm() {
  if (activeLocationId) {
    const effectiveColor = color || '';
    const effectiveParent = parent || null;
    if (effectiveColor || effectiveParent) {
      apiFetch('/api/tag-colors', {
        method: 'PUT',
        body: { locationId: activeLocationId, tag: tagName, color: effectiveColor, parentTag: effectiveParent },
      }).then(() => notify(Events.TAG_COLORS));
    }
  }
  onConfirm();
}
```

Add imports for `apiFetch`, `Events`, `notify`, `useMemo`.

Add parent dropdown JSX between the color picker and the footer:

```tsx
{parentOptions.length > 0 && (
  <div className="space-y-2">
    <Label>Parent</Label>
    <select
      value={parent}
      onChange={(e) => setParent(e.target.value)}
      className={cn(inputBase, 'h-10')}
    >
      <option value="">None</option>
      {parentOptions.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
    {parent && (
      <p className="text-[12px] text-[var(--text-tertiary)]">
        Will be grouped under: <span className="font-medium text-[var(--text-secondary)]">{parent}</span>
      </p>
    )}
  </div>
)}
```

Import `inputBase` from `@/lib/utils` and `notify, Events` from `@/lib/eventBus` and `apiFetch` from `@/lib/api`.

- [ ] **Step 2: Update TagInput to pass new props to CreateTagDialog**

In `src/features/bins/TagInput.tsx`, update the `CreateTagDialog` usage to pass `suggestions` and `tagParents`:

```tsx
import { useTagColorsContext } from '@/features/tags/TagColorsContext';

// Inside the component:
const { tagParents } = useTagColorsContext();

// In JSX:
<CreateTagDialog
  open={pendingCreateTag !== null}
  onOpenChange={(v) => { if (!v) setPendingCreateTag(null); }}
  tagName={pendingCreateTag ?? ''}
  onConfirm={() => {
    if (pendingCreateTag) addTag(pendingCreateTag);
    setPendingCreateTag(null);
  }}
  suggestions={suggestions}
  tagParents={tagParents}
/>
```

- [ ] **Step 3: Verify types compile and lint**

Run: `npx tsc --noEmit && npx biome check src/features/tags/CreateTagDialog.tsx src/features/bins/TagInput.tsx`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/features/tags/CreateTagDialog.tsx src/features/bins/TagInput.tsx
git commit -m "feat: add parent dropdown to CreateTagDialog"
```

---

### Task 7: Client — TagInput Grouped Dropdown

**Files:**
- Modify: `src/features/bins/TagInput.tsx`

- [ ] **Step 1: Build grouped tag list for browse mode**

Add a `useMemo` that groups the `available` tags by parent. Import `useTagColorsContext` (if not already imported from Task 6):

```typescript
const { tagParents } = useTagColorsContext();

// Build grouped list for browse mode (no search text)
const groupedAvailable = useMemo(() => {
  if (trimmedInput) return null; // Use flat filtered list during search

  const parentToChildren = new Map<string, string[]>();
  const ungrouped: string[] = [];
  const parentSet = new Set<string>();

  // Identify all parents
  for (const [child, parent] of tagParents) {
    parentSet.add(parent);
  }

  // Group available tags
  for (const tag of available) {
    const parent = tagParents.get(tag);
    if (parent && available.includes(parent)) {
      // This is a child and its parent is also available
      const list = parentToChildren.get(parent) || [];
      list.push(tag);
      parentToChildren.set(parent, list);
    } else if (parent && !available.includes(parent)) {
      // Parent already added to bin — show child as ungrouped with hint
      ungrouped.push(tag);
    } else if (!parentSet.has(tag)) {
      ungrouped.push(tag);
    }
    // Parents are handled as group headers, not pushed to ungrouped
  }

  // Sort children alphabetically within each group
  for (const children of parentToChildren.values()) {
    children.sort();
  }

  // Build ordered list of parent tags
  const parents = [...parentToChildren.keys()].sort();

  return { parents, parentToChildren, ungrouped: ungrouped.sort() };
}, [available, tagParents, trimmedInput]);
```

- [ ] **Step 2: Render grouped dropdown when browsing**

Replace the dropdown content section (the `filtered.map(...)` block and `showCreate` block) with conditional rendering:

```tsx
<div className="max-h-48 overflow-auto py-1">
  {groupedAvailable ? (
    <>
      {/* Parent groups */}
      {groupedAvailable.parents.map((parent) => {
        const parentStyle = getTagStyle(parent);
        const children = groupedAvailable.parentToChildren.get(parent) || [];
        return (
          <div key={parent}>
            {/* Parent header — clickable to add parent tag */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); addTag(parent); }}
              className="flex w-full items-center gap-2 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-quaternary)] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={parentStyle ? { backgroundColor: parentStyle.backgroundColor as string } : { backgroundColor: 'var(--text-tertiary)', opacity: 0.3 }}
              />
              {parent}
            </button>
            {/* Children */}
            {children.map((tag, i) => {
              const tagStyle = getTagStyle(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); addTag(tag); }}
                  className={cn(dropdownRow, 'pl-7 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]')}
                >
                  {tagStyle ? (
                    <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: tagStyle.backgroundColor as string }} />
                  ) : (
                    <span className="h-3 w-3 flex-shrink-0 rounded-full bg-[var(--text-tertiary)] opacity-30" />
                  )}
                  <span>{tag}</span>
                </button>
              );
            })}
            <div className="mx-3 my-1 border-t border-[var(--border-subtle)]" />
          </div>
        );
      })}
      {/* Ungrouped tags */}
      {groupedAvailable.ungrouped.map((tag) => {
        const tagStyle = getTagStyle(tag);
        return (
          <button
            key={tag}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); addTag(tag); }}
            className={cn(dropdownRow, 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]')}
          >
            {tagStyle ? (
              <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: tagStyle.backgroundColor as string }} />
            ) : (
              <span className="h-3 w-3 flex-shrink-0 rounded-full bg-[var(--text-tertiary)] opacity-30" />
            )}
            <span>{tag}</span>
          </button>
        );
      })}
    </>
  ) : (
    /* Existing flat filtered list — used during search */
    <>
      {filtered.map((tag, i) => {
        const tagStyle = getTagStyle(tag);
        const parentHint = tagParents.get(tag);
        const isHighlighted = i === highlightIndex;
        return (
          <button
            key={tag}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); addTag(tag); }}
            className={cn(
              dropdownRow,
              isHighlighted
                ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
            )}
          >
            {tagStyle ? (
              <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: tagStyle.backgroundColor as string }} />
            ) : (
              <span className="h-3 w-3 flex-shrink-0 rounded-full bg-[var(--text-tertiary)] opacity-30" />
            )}
            <span>{tag}</span>
            {parentHint && (
              <span className="ml-auto text-[10px] text-[var(--text-quaternary)]">{parentHint}</span>
            )}
          </button>
        );
      })}
    </>
  )}
  {/* Create option — always at bottom */}
  {showCreate && (
    <>
      {(groupedAvailable ? groupedAvailable.ungrouped.length > 0 || groupedAvailable.parents.length > 0 : filtered.length > 0) && (
        <div className="mx-3 my-1 border-t border-[var(--border-subtle)]" />
      )}
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); openCreateDialog(trimmedInput); }}
        className={cn(
          dropdownRow,
          highlightIndex === filtered.length
            ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
        )}
      >
        <Plus className="h-3.5 w-3.5 flex-shrink-0 text-[var(--accent)]" />
        <span>Create <span className="font-medium text-[var(--text-primary)]">{trimmedInput}</span></span>
      </button>
    </>
  )}
</div>
```

Note: keyboard navigation (`highlightIndex`) applies only in search mode (flat filtered list). In grouped browse mode, navigation is mouse-only (highlight index is not used since grouping changes the item count model). This is acceptable — users browse by scrolling/clicking, search by typing.

- [ ] **Step 3: Verify types compile and lint**

Run: `npx tsc --noEmit && npx biome check src/features/bins/TagInput.tsx`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/features/bins/TagInput.tsx
git commit -m "feat: group tags by parent in TagInput dropdown"
```

---

### Task 8: Client — TagTableView Inline Tree

**Files:**
- Modify: `src/features/tags/TagTableView.tsx`

- [ ] **Step 1: Add `tagParents` prop and build tree-ordered list**

Add `tagParents` to props:

```typescript
interface TagTableViewProps {
  tags: TagEntry[];
  // ... existing props ...
  tagParents: Map<string, string>;
  // ... existing props ...
}
```

Add a `useMemo` to sort tags into tree order (parents first with children below, then ungrouped):

```typescript
const [collapsedParents, setCollapsedParents] = useState<Set<string>>(() => {
  const stored = localStorage.getItem('openbin-tag-tree-collapsed');
  return stored ? new Set(JSON.parse(stored)) : new Set();
});

function toggleCollapse(parent: string) {
  setCollapsedParents((prev) => {
    const next = new Set(prev);
    if (next.has(parent)) next.delete(parent); else next.add(parent);
    localStorage.setItem('openbin-tag-tree-collapsed', JSON.stringify([...next]));
    return next;
  });
}

// Identify parent tags (tags that have children)
const parentSet = useMemo(() => {
  const set = new Set<string>();
  for (const [, parent] of tagParents) set.add(parent);
  return set;
}, [tagParents]);

// Build tree-ordered tag list
const orderedTags = useMemo(() => {
  const result: Array<TagEntry & { isChild: boolean; isParent: boolean }> = [];
  const childrenByParent = new Map<string, TagEntry[]>();
  const standalone: TagEntry[] = [];

  for (const tag of tags) {
    const parent = tagParents.get(tag.tag);
    if (parent) {
      const list = childrenByParent.get(parent) || [];
      list.push(tag);
      childrenByParent.set(parent, list);
    } else if (parentSet.has(tag.tag)) {
      // This is a parent — insert it with its children
      result.push({ ...tag, isChild: false, isParent: true });
      // Children will be inserted after all tags are scanned
    } else {
      standalone.push(tag);
    }
  }

  // Re-build result: parents with children interleaved
  const finalResult: Array<TagEntry & { isChild: boolean; isParent: boolean }> = [];
  const processedParents = new Set<string>();

  for (const tag of tags) {
    if (tagParents.get(tag.tag)) continue; // Skip children — they're added under parents
    if (parentSet.has(tag.tag)) {
      if (processedParents.has(tag.tag)) continue;
      processedParents.add(tag.tag);
      finalResult.push({ ...tag, isChild: false, isParent: true });
      if (!collapsedParents.has(tag.tag)) {
        const children = childrenByParent.get(tag.tag) || [];
        for (const child of children) {
          finalResult.push({ ...child, isChild: true, isParent: false });
        }
      }
    } else {
      finalResult.push({ ...tag, isChild: false, isParent: false });
    }
  }

  return finalResult;
}, [tags, tagParents, parentSet, collapsedParents]);
```

- [ ] **Step 2: Update row rendering for tree layout**

Import `ChevronDown, ChevronRight` from lucide-react. Update the table row mapping to use `orderedTags` and render indentation + chevrons:

```tsx
{orderedTags.map(({ tag, count, isChild, isParent }) => (
  <TableRow
    key={tag}
    onClick={() => navigate(`/bins?tags=${encodeURIComponent(tag)}`)}
    className={cn(isChild && 'bg-[var(--bg-hover)]/30')}
  >
    <td className="px-3 py-2.5 flex-[2] min-w-0">
      <div className={cn('flex items-center gap-2', isChild && 'pl-7')}>
        {isParent && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleCollapse(tag); }}
            className="p-0.5 text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {collapsedParents.has(tag) ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        <Badge variant="secondary" style={getTagBadgeStyle(tag)}>
          <Highlight text={tag} query={searchQuery} />
        </Badge>
      </div>
    </td>
    {/* ... count, color picker, actions menu (same as before) ... */}
  </TableRow>
))}
```

- [ ] **Step 3: Pass `tagParents` from TagsPage**

In `src/features/tags/TagsPage.tsx`, pass `tagParents` to `TagTableView`:

```tsx
const { tagColors, tagParents } = useTagColorsContext();

// ... in JSX:
<TagTableView
  tags={tags}
  // ... existing props ...
  tagParents={tagParents}
  // ... existing props ...
/>
```

- [ ] **Step 4: Verify types compile and lint**

Run: `npx tsc --noEmit && npx biome check src/features/tags/TagTableView.tsx src/features/tags/TagsPage.tsx`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/features/tags/TagTableView.tsx src/features/tags/TagsPage.tsx
git commit -m "feat: inline tree layout for TagTableView with collapse/expand"
```

---

### Task 9: Client — TagsPage Actions (Set Parent, Add Child, Delete Cascade)

**Files:**
- Modify: `src/features/tags/TagsPage.tsx`
- Modify: `src/features/tags/TagTableView.tsx`

- [ ] **Step 1: Add "Set Parent" and "Add Child Tag" actions to TagRowMenu**

In `TagTableView.tsx`, extend `TagRowMenu` props and add the new menu items:

```typescript
interface TagRowMenuProps {
  tag: string;
  isParent: boolean;
  hasChildren: boolean; // for the tag being acted on — true if it has children
  onRename?: (tag: string) => void;
  onDelete?: (tag: string) => void;
  onSetParent?: (tag: string) => void;
  onAddChild?: (tag: string) => void;
}
```

In the menu popover, add between Rename and Delete:

```tsx
{onSetParent && !hasChildren && (
  <button type="button" onClick={() => { close(); onSetParent(tag); }} className={menuItem}>
    <ArrowUpFromLine className="h-3.5 w-3.5" />
    Set Parent...
  </button>
)}
{onAddChild && isParent && (
  <button type="button" onClick={() => { close(); onAddChild(tag); }} className={menuItem}>
    <Plus className="h-3.5 w-3.5" />
    Add Child Tag...
  </button>
)}
```

Import `ArrowUpFromLine, Plus` from lucide-react.

Pass `onSetParent` and `onAddChild` through `TagTableViewProps` and down to `TagRowMenu`.

- [ ] **Step 2: Add "Set Parent" dialog to TagsPage**

In `TagsPage.tsx`, add state and handler:

```typescript
import { setTagParent } from './useTagColors';

// State
const [parentTarget, setParentTarget] = useState<string | null>(null);
const [parentValue, setParentValue] = useState('');
const [parentLoading, setParentLoading] = useState(false);

// Parent-eligible tags: not themselves children
const parentEligible = useMemo(() => {
  return tags.map((t) => t.tag).filter((t) => !tagParents.has(t) && t !== parentTarget);
}, [tags, tagParents, parentTarget]);

function handleSetParentOpen(tag: string) {
  setParentTarget(tag);
  setParentValue(tagParents.get(tag) || '');
}

async function handleSetParentSubmit() {
  if (!activeLocationId || !parentTarget) return;
  setParentLoading(true);
  try {
    const currentColor = tagColors.get(parentTarget) || '';
    await setTagParent(activeLocationId, parentTarget, parentValue || null, currentColor);
    showToast({ message: parentValue ? `Set parent of "${parentTarget}" to "${parentValue}"` : `Removed parent from "${parentTarget}"` });
    setParentTarget(null);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to set parent';
    showToast({ message: msg, variant: 'error' });
  } finally {
    setParentLoading(false);
  }
}
```

Add the dialog JSX after the existing delete dialog:

```tsx
<Dialog open={parentTarget !== null} onOpenChange={(open) => { if (!open) setParentTarget(null); }}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Set Parent</DialogTitle>
      <DialogDescription>
        Choose a parent tag for &ldquo;{parentTarget}&rdquo;.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-2">
      <Label htmlFor="set-parent-select">Parent</Label>
      <select
        id="set-parent-select"
        value={parentValue}
        onChange={(e) => setParentValue(e.target.value)}
        className={cn(inputBase, 'h-10')}
      >
        <option value="">None</option>
        {parentEligible.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
    <DialogFooter>
      <Button variant="secondary" onClick={() => setParentTarget(null)} disabled={parentLoading}>Cancel</Button>
      <Button onClick={handleSetParentSubmit} disabled={parentLoading}>
        {parentLoading ? 'Saving...' : 'Save'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Import `inputBase` from `@/lib/utils`.

- [ ] **Step 3: Add "Add Child Tag" handler**

In `TagsPage.tsx`, add state for the create-child flow:

```typescript
const [addChildParent, setAddChildParent] = useState<string | null>(null);
```

Render `CreateTagDialog` for the "Add Child Tag" action:

```tsx
<CreateTagDialog
  open={addChildParent !== null}
  onOpenChange={(open) => { if (!open) setAddChildParent(null); }}
  tagName=""
  onConfirm={() => setAddChildParent(null)}
  suggestions={tags.map((t) => t.tag)}
  tagParents={tagParents}
  defaultParent={addChildParent}
/>
```

Wait — `CreateTagDialog` expects a `tagName` (the new tag being created). But "Add Child Tag" needs to let the user type a name. This doesn't quite fit the existing dialog which assumes the name is already known.

The simpler approach: "Add Child Tag" from the Tags page just opens the "Set Parent" flow in reverse — the user creates a new tag in TagInput on a bin, or we repurpose the dialog. For now, skip "Add Child Tag" from the Tags page — users create child tags via the normal CreateTagDialog (which now has the parent picker). This avoids adding a name input to the dialog.

Remove the "Add Child Tag" menu item from this task. Users set parent relationships via:
1. CreateTagDialog when creating new tags (parent dropdown)
2. "Set Parent..." action on existing tags in the Tags page

- [ ] **Step 4: Update delete handler to show orphan toast**

Update `handleDeleteConfirm` to include the orphan count in the toast:

```typescript
async function handleDeleteConfirm() {
  if (!activeLocationId || !deleteTarget) return;
  setDeleteLoading(true);
  try {
    const result = await deleteTag(activeLocationId, deleteTarget);
    const orphanMsg = result.orphanedChildren
      ? ` — ${result.orphanedChildren} child tag${result.orphanedChildren === 1 ? '' : 's'} moved to top level`
      : '';
    showToast({ message: `Removed "${deleteTarget}" from ${result.binsUpdated} ${result.binsUpdated === 1 ? t.bin : t.bins}${orphanMsg}` });
    setDeleteTarget(null);
  } catch {
    showToast({ message: 'Failed to delete tag', variant: 'error' });
  } finally {
    setDeleteLoading(false);
  }
}
```

Update `deleteTag` return type in `useTags.ts` to include `orphanedChildren`:

```typescript
export async function deleteTag(locationId: string, tag: string): Promise<{ binsUpdated: number; orphanedChildren?: number }> {
```

- [ ] **Step 5: Pass action handlers to TagTableView**

In `TagsPage.tsx`, pass the new handlers:

```tsx
<TagTableView
  // ... existing props ...
  onSetParent={canWrite ? handleSetParentOpen : undefined}
/>
```

- [ ] **Step 6: Verify full build passes**

Run: `npx tsc --noEmit && npx biome check . && npx vite build`
Expected: No type errors, no lint errors, build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/features/tags/TagsPage.tsx src/features/tags/TagTableView.tsx src/features/tags/useTags.ts
git commit -m "feat: add Set Parent dialog and delete cascade toast to TagsPage"
```

---

### Task 10: Manual Verification

- [ ] **Step 1: Start dev servers**

Run: `npm run dev:all`

- [ ] **Step 2: Test tag creation with parent**

1. Navigate to a bin detail page
2. In the Tags field, type a new tag name
3. Click "Create xxx" — dialog should open with color picker AND parent dropdown
4. Select a parent tag and color, click Create
5. Verify the tag is added to the bin and appears with color in the dropdown

- [ ] **Step 3: Test Tags page tree view**

1. Navigate to /tags
2. Verify parent tags show collapse chevrons
3. Verify children are indented below parents
4. Click collapse — children hide. Click expand — children reappear.
5. Reload page — collapse state persisted

- [ ] **Step 4: Test Set Parent action**

1. On Tags page, click `...` menu on a tag
2. Click "Set Parent..."
3. Select a parent from dropdown, click Save
4. Verify the tag now appears as a child in the tree

- [ ] **Step 5: Test implicit filter inheritance**

1. Navigate to /bins
2. Filter by a parent tag
3. Verify bins tagged with child tags also appear in results

- [ ] **Step 6: Test delete cascade**

1. On Tags page, delete a parent tag
2. Verify toast shows "N child tags moved to top level"
3. Verify children now appear as top-level tags

- [ ] **Step 7: Test rename cascade**

1. On Tags page, rename a parent tag
2. Verify children still reference the renamed parent

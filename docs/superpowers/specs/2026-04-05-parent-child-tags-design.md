# Parent/Child Tag Hierarchy

Single-level tag hierarchy with implicit inheritance for filtering. Modeled after paperless-ngx but adapted to OpenBin's freeform tag system.

## Decisions

| Decision | Choice |
|----------|--------|
| Inheritance model | Implicit — filtering by parent includes children |
| Depth | Single level (parent → children, no grandchildren) |
| Display on bins | Only the assigned tag shown (parent is invisible on the bin) |
| Color inheritance | None — each tag's color is independent |
| Parent deletion | Children become top-level (orphaned) |
| Data approach | Extend existing `tag_colors` table with `parent_tag` column |

## Data Layer

### Schema

Add `parent_tag` column to `tag_colors` in both `schema.sqlite.sql` and `schema.pg.sql`:

```sql
parent_tag TEXT DEFAULT NULL
```

For the fresh DB (alpha, no users), add the column directly to the CREATE TABLE statement. A tag entry with a parent but no color uses `color = ''` (empty string satisfies the existing NOT NULL constraint; client already treats falsy color as "no color").

### Constraints (enforced in application code)

- A child tag cannot itself be a parent (single-level depth). When setting a parent for tag X, reject if X already has children.
- A tag cannot be its own parent.
- `parent_tag` must reference an existing tag name within the same location. Validation happens at the API layer.

### API Changes

**Extended endpoints:**

- `PUT /api/tag-colors` — accepts optional `parentTag` field alongside `color`. When `parentTag` is provided, upserts the row with the parent relationship. When `parentTag` is `null` or `""`, clears the parent.
- `GET /api/tag-colors` — response includes `parent_tag` in each `TagColor` entry.
- `GET /api/tags` — response includes `parent_tag` for each tag (LEFT JOIN from tag_colors).

**Cascade behavior:**

- `PUT /api/tags/rename` — when renaming a tag, also updates `parent_tag` references in any children's tag_colors entries (i.e., `UPDATE tag_colors SET parent_tag = ? WHERE parent_tag = ? AND location_id = ?`).
- `DELETE /api/tags/:tag` — when deleting a parent, SET NULL on children's `parent_tag` before deleting the parent's own tag_colors entry. Toast message: `Removed "electronics" — 2 child tags moved to top level`.

### Bin Filtering

When filtering bins by tag X via `/api/bins?tags=X`, expand the match to include children:

```sql
WHERE value = ?
   OR value IN (SELECT tag FROM tag_colors WHERE parent_tag = ? AND location_id = ?)
```

**Tag mode behavior:**

- `tag_mode=any` (OR): bin matches if it has the parent tag OR any child of that parent.
- `tag_mode=all` (AND): each tag in the filter is expanded independently. `tags=electronics,fragile` matches bins that have (electronics OR cables OR batteries) AND fragile.
- Child tags in the filter are NOT expanded upward — filtering by "cables" only matches "cables", not all "electronics" children.

**Text search:** No hierarchy expansion for free-text search. Hierarchy only affects tag filter parameters.

## Client Data Flow

### Hook & Context Changes

- `useTagColors` returns `{ tagColors, tagParents, isLoading }` where `tagParents` is `Map<string, string>` mapping child tag name → parent tag name.
- `TagColorsContext` extended to expose `tagParents` alongside `tagColors`.
- `TagColor` type in `src/types.ts` gets `parent_tag: string | null` field.

## UI: Tags Page (Inline Tree)

### TagTableView Layout

- Tags sorted with parents first, children grouped directly below their parent.
- Parent rows show a collapse/expand chevron (left of the badge), using `ChevronDown`/`ChevronRight` from lucide-react.
- Child rows indented ~28px with subtle background tint.
- Parent's "Bins" count shows own count only (not aggregate). Children show their own counts below.
- Collapse state persisted in `localStorage`.
- Ungrouped (parentless, non-parent) tags listed after all parent groups in alphabetical order.

**Edge case:** A parent tag that exists only in `tag_colors` (has children) but isn't used on any bin won't appear in the `GET /api/tags` aggregation. The Tags page query must UNION parent tags from `tag_colors` that have children, even if they have 0 bin usage, so the tree structure is always visible.

### Actions Menu Additions

Existing actions: Rename, Delete.

New actions:

- **"Set Parent..."** (all tags) — opens a dialog with a dropdown listing all parent-eligible tags (tags that are NOT already children). Includes "None" to remove parent. If the tag already has children, this action is disabled (enforces single-level depth).
- **"Add Child Tag..."** (parent tags only) — opens the CreateTagDialog with the parent pre-selected.

### Delete Behavior

- Deleting a parent: children become top-level. Toast: `Removed "electronics" — 2 child tags moved to top level`.
- Deleting a child: standard behavior, no special messaging.

## UI: TagInput Dropdown (Grouped by Parent)

### No Search Text (browsing)

Tags grouped by parent:

1. **Parent groups**: parent tag name shown as a small uppercase section header with its color dot. The header is clickable (adds the parent tag to the bin). Children listed below, indented.
2. **Ungrouped tags**: listed after all groups, separated by a subtle divider.

### During Search

Flat filtered results (no grouping) — grouping during search would be confusing since partial matches break the hierarchy. Child tags show their parent name as small muted text on the right side.

### "Create" Option

Unchanged — "Create xxx" at the bottom still opens the CreateTagDialog.

## UI: CreateTagDialog

### New "Parent" Section

Added below the color picker, above the footer buttons:

- Label: "Parent"
- Dropdown listing all parent-eligible tags in the current location. A tag is parent-eligible if it is NOT itself a child of another tag (enforces single-level). Tags that are already parents can be selected (they can have multiple children).
- Default: "None" (no parent).
- Pre-populated when opened via "Add Child Tag..." from the Tags page.
- No visual preview change for parent selection — just a label below: `Will be grouped under: electronics`.

## Files to Modify

### Server

- `server/schema.sqlite.sql` — add `parent_tag` column to `tag_colors` CREATE TABLE
- `server/schema.pg.sql` — same
- `server/src/routes/tagColors.ts` — extend PUT to accept `parentTag`, extend GET response
- `server/src/routes/tags.ts` — extend GET to include `parent_tag` via JOIN, update rename/delete to cascade parent references
- `server/src/lib/binQueries.ts` — modify tag filter query to expand parent tags to include children
- `server/openapi.yaml` — update TagColor schema and tag endpoints

### Client

- `src/types.ts` — add `parent_tag` to `TagColor` type
- `src/features/tags/useTagColors.ts` — extend hook to return `tagParents` Map
- `src/features/tags/TagColorsContext.tsx` — expose `tagParents` in context
- `src/features/tags/TagTableView.tsx` — inline tree layout with collapse/expand, indented children
- `src/features/tags/TagsPage.tsx` — "Set Parent" dialog, "Add Child Tag" action
- `src/features/tags/CreateTagDialog.tsx` — add parent dropdown
- `src/features/bins/TagInput.tsx` — grouped dropdown when browsing, flat with hints when searching

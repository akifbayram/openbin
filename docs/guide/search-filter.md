---
prev:
  text: 'Print Labels'
  link: '/guide/print-labels'
next:
  text: 'Dashboard'
  link: '/guide/dashboard'
---

# Search & Filter

OpenBin's search and filter tools let you find bins quickly across large collections. Searches run live as you type, and filters can be combined and saved for reuse.

## Search Bar

The search bar at the top of the bin list searches across all of the following simultaneously:

- Bin names
- Item names (items inside bins)
- Tags
- Notes

Results update as you type (debounced to avoid unnecessary requests). Clearing the search bar returns the full list.

## Filter Panel

Click the **Filter** button (or funnel icon) to expand the filter panel. Filters can be combined — all active filters are applied together.

### Filter by Tag

Select one or more tags from the tag list. By default, bins matching **any** of the selected tags are shown. Switch the tag mode to **All** to show only bins that have every selected tag.

### Filter by Area

Select an area to show only bins assigned to it. Choose **Unassigned** to show bins with no area.

### Filter by Color

Select one or more color swatches to filter bins by their assigned color.

### Filter by Visibility

Filter to show only `location`-visible bins or only your `private` bins.

## Sort Options

Use the **Sort** menu to change the order of bins:

| Sort option | Description |
|---|---|
| Name A–Z | Alphabetical ascending |
| Name Z–A | Alphabetical descending |
| Created (newest) | Most recently created first |
| Created (oldest) | Oldest first |
| Updated (newest) | Most recently edited first |
| Area | Grouped by area name |

## Column Visibility

In the **list view** (table mode), use the column visibility menu to toggle which columns are displayed:

- Name
- Area
- Tags
- Item count
- Created date
- Updated date

Column preferences are saved per session.

## View Mode

Toggle between **grid view** (cards) and **list view** (table) using the view mode control. Both views support the same search, filter, and sort options.

## Active Filter Count

The filter button shows a badge with the number of active filters. This makes it easy to see at a glance when results are being filtered.

## Clearing Filters

Click **Clear** in the filter panel to reset all active filters at once. The search bar is cleared separately.

## Saved Views

Save frequently-used filter and sort combinations as named views:

1. Set your desired filters and sort order.
2. Click the **Save View** button.
3. Enter a name for the view and confirm.

Saved views appear on the [Dashboard](/guide/dashboard) as quick-access buttons. Clicking a saved view opens the bin list with those filters pre-applied.

::: tip
Saved views are personal — they are stored per user, not shared across the location.
:::

## Related

- [Dashboard](/guide/dashboard) — Access saved views and see location stats
- [Bins](/guide/bins) — The bins you're searching and filtering

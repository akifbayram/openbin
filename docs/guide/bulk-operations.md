---
prev:
  text: 'Bulk Add'
  link: '/guide/bulk-add'
next:
  text: 'Import & Export'
  link: '/guide/import-export'
---

# Bulk Operations

Bulk operations let you perform the same action on many bins at once — saving time when reorganizing, retagging, or cleaning up a large collection.

## Entering Multi-Select Mode

### Mobile

Long-press any bin card to enter multi-select mode. A checkbox appears on each card. Tap cards to select or deselect them.

### Desktop

Hover over a bin card — a checkbox appears in the corner. Click it to select the bin and enter multi-select mode. Continue clicking other checkboxes to add to the selection.

## Select All / None

While in multi-select mode, use the **Select All** control at the top of the bin list to select all bins currently visible (respecting any active search or filter). Use **Select None** to clear the selection without leaving multi-select mode.

## Bulk Action Bar

When one or more bins are selected, a bulk action bar appears at the bottom of the screen. It shows the count of selected bins and buttons for each available operation.

## Available Bulk Actions

### Bulk Tag

Add or remove tags from all selected bins at once.

- **Add tags**: enter one or more tag names. The tags are merged with each bin's existing tags (existing tags are not removed).
- **Remove tags**: select tags to remove from all selected bins.

### Bulk Move

Move selected bins to a different area or a different location.

- **Change area**: reassign all selected bins to a different area within the current location, or remove their area assignment (set to Unassigned).
- **Move to location**: move all selected bins to a different location entirely. Requires admin role. After moving, the bins appear in the target location with their area unassigned.

### Bulk Appearance

Set the icon, color, and card style across all selected bins in one operation.

- The dialog shows separate sections for icon, color, and card style.
- Only the sections you actually change are applied — a dirty-flag system tracks which fields were modified.
- For example, if you change the color but not the icon, existing icons on the selected bins are preserved.

### Bulk Visibility

Set the visibility of all selected bins to either `location` (visible to all members) or `private` (visible only to you).

### Bulk Delete

Move all selected bins to Trash. This is a soft delete — bins can be restored from Trash. See [Locations & Areas → Trash and Retention](/guide/locations#trash-and-retention) for details.

::: warning
Bulk delete moves all selected bins to Trash at once. Double-check your selection before confirming. Bins with private visibility set by other users cannot be bulk-deleted unless you are an admin.
:::

## Leaving Multi-Select Mode

Tap **Cancel** in the bulk action bar, or tap an empty area of the screen (mobile), to exit multi-select mode without performing any action.

## Related

- [Bins](/guide/bins) — Create and manage individual bins
- [Items & Tags](/guide/items-tags) — Browse all items and tags across your location

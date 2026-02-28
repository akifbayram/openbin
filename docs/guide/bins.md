---
prev:
  text: 'Locations & Areas'
  link: '/guide/locations'
next:
  text: 'QR Scanning'
  link: '/guide/qr-scanning'
---

# Bins

Bins are the core objects in OpenBin. Each bin represents a physical storage container — a box, drawer, shelf, or bin — and holds a structured list of items along with tags, notes, and visual appearance settings.

## What is a Bin?

A bin has a name, an auto-generated short code used in its QR label, and a collection of fields that describe its contents and appearance. Every bin belongs to one location and optionally to one area within that location.

## Creating a Bin

1. On the bin list page, tap the **+** button or **New Bin**.
2. Enter a name — this is the only required field.
3. Optionally fill in items, tags, notes, icon, color, and area.
4. Save.

The short code is auto-generated from the bin name and appears on printed QR labels.

## Items

Items are a discrete, ordered list of things inside the bin. Each item is a separate entry — not a freeform block of text.

- **Add**: type a name and press Enter or tap Add.
- **Remove**: tap the delete icon next to an item.
- **Rename**: tap the item name to edit it inline.
- **Reorder**: drag and drop items to rearrange them.

::: tip
Items are searchable. Searching "screwdriver" will find bins that have "screwdriver" in their items list.
:::

## Tags

Tags are short labels for categorizing bins. A bin can have any number of tags.

- Tags are shared across the location — adding a new tag makes it available to other bins.
- Tags can be assigned custom colors per location (see Settings → Tags).
- Filter the bin list by one or more tags using the filter panel.

## Notes

The notes field is a freeform text area for any additional information about the bin — purchase links, instructions, warnings, or context.

## Icon

Each bin can have an emoji or icon displayed on its card and printed label. Pick an icon from the icon picker when creating or editing a bin.

## Color

The color field sets the background tint of the bin card. OpenBin uses a hue-based continuous color picker:

1. Select a hue from the gradient bar.
2. Choose a shade from the swatches below it.

The chosen color is applied to the bin card background and affects the label in `colored-card` print mode.

## Card Styles

Card style controls the visual treatment of the bin card beyond just color. The style is configured in the appearance section when editing a bin.

| Style | Description |
|---|---|
| `glass` | Default frosted-glass look. No extra configuration. |
| `border` | Colored border accent around the card. Configurable style (solid, dashed, dotted, double) and width (1–8 px). |
| `gradient` | Two-color diagonal gradient. Pick a primary color and an end color. |
| `stripe` | Colored stripe on one side of the card. Configure position (left, right, top, bottom) and width (1–10 units). |
| `photo` | Uses one of the bin's attached photos as the full card background image. |

## Visibility

| Value | Who can see it |
|---|---|
| `location` | All members of the location |
| `private` | Only you (the bin creator) |

Set visibility when creating or editing a bin. Admins can see all bins regardless of visibility.

## Short Code

Every bin has a 6-character alphanumeric short code auto-generated from its name at creation time. The short code:

- Appears printed on QR labels alongside the QR code itself.
- Can be typed manually into the scanner or search bar to look up a bin without a camera.
- Is stable — it does not change if you rename the bin.

## Editing a Bin

Tap any bin card to open its detail page, then tap **Edit**. All fields are editable. Changes are saved on confirmation.

## Soft Delete and Trash

Deleting a bin moves it to Trash — it is not permanently removed. From Trash (Settings → Trash), you can:

- **Restore** — returns the bin to the active list.
- **Permanently delete** — removes the bin and all its photos. This cannot be undone.

Bins in Trash are automatically purged after the location's configured retention period.

## Related

- [Photos](/guide/photos) — Attach photos to bins and use them with AI
- [Print Labels](/guide/print-labels) — Generate QR labels for your bins
- [QR Scanning](/guide/qr-scanning) — Scan bin labels to find contents
- [AI Features](/guide/ai) — AI photo analysis and natural language commands
- [Items & Tags](/guide/items-tags) — Browse all items and tags across your location
- [API: Bins](/api/bins) — Bins REST API reference

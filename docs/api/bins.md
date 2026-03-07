---
title: Bins
---

# Bins

::: tip User Guide
For a user-facing walkthrough, see [Bins](/guide/bins).
:::

Bin CRUD, soft delete, restore, permanent deletion, QR lookup, items, tags, pinning, and photo upload.

---

### POST /api/bins

Creates a new bin. The bin ID is an auto-generated 6-character alphanumeric short code (charset excludes ambiguous characters: `0`, `O`, `1`, `l`, `I`).

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Max 255 characters |
| `locationId` | UUID | Yes | Location to create the bin in |
| `items` | (string \| object)[] | No | Up to 500 initial items. Each element can be a plain string or an object `{ name, quantity? }`. See [Item format](#item-format). |
| `notes` | string | No | Max 10,000 characters |
| `tags` | string[] | No | Up to 50 tags |
| `areaId` | UUID | No | Area to assign the bin to |
| `icon` | string | No | PascalCase Lucide icon name |
| `color` | string | No | Color preset key |
| `cardStyle` | string | No | JSON-encoded card style configuration |
| `visibility` | `"location"` or `"private"` | No | Defaults to `"location"` |

**Response (201)**: The created `Bin` object.

---

### GET /api/bins

Lists non-deleted bins for a location. Supports search, filtering, sorting, and pagination.

**Query parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `location_id` | UUID | Yes | Location to query |
| `q` | string | No | Full-text search across name, items, notes, tags, ID, and area name |
| `tag` | string | No | Filter by a single exact tag |
| `tags` | string | No | Comma-separated tag names; combined with `tag_mode` |
| `tag_mode` | `"any"` or `"all"` | No | Whether bins must match any or all of the specified tags. Default: `"any"` |
| `area_id` | string | No | Filter by area UUID. Use `__unassigned__` for bins with no area. Superseded by `areas`. |
| `areas` | string | No | Comma-separated area UUIDs. Supports `__unassigned__`. Takes precedence over `area_id`. |
| `colors` | string | No | Comma-separated color keys to filter by |
| `has_items` | `"true"` | No | Only return bins that have at least one item |
| `has_notes` | `"true"` | No | Only return bins with non-empty notes |
| `needs_organizing` | `"true"` | No | Return bins that are missing tags, area assignment, and items |
| `sort` | `"name"`, `"created_at"`, `"updated_at"`, `"area"` | No | Default: `"updated_at"` |
| `sort_dir` | `"asc"` or `"desc"` | No | Default: `"desc"` |
| `limit` | integer (1–100) | No | Page size. When provided, `count` returns total matching rows. |
| `offset` | integer | No | Rows to skip (used with `limit`). Default: `0` |

**Response (200)**

```json
{
  "results": [ /* Bin objects */ ],
  "count": 150
}
```

---

### GET /api/bins/trash

Returns soft-deleted bins (those with a non-null `deleted_at`). Bins are auto-purged after the location's configured `trash_retention_days` (default 30).

**Query parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `location_id` | UUID | Yes | |

**Response (200)**: `{ results: Bin[], count: number }`

---

### GET /api/bins/lookup/`{shortCode}`

Looks up a bin by its 6-character short code ID. This is a legacy alias for `GET /api/bins/{id}` — since bin IDs are now short codes, the two endpoints are equivalent.

**Path parameters**: `shortCode` (6 characters)

**Response (200)**: `Bin` object.

---

### GET /api/bins/pinned

Returns the authenticated user's pinned bins in the specified location, ordered by pin position.

**Query parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `location_id` | UUID | Yes | |

**Response (200)**: `{ results: Bin[], count: number }`

---

### PUT /api/bins/pinned/reorder

Reorders the authenticated user's pinned bins.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `bin_ids` | UUID[] | Yes | Bin IDs in the desired pin order |

**Response (200)**: `{ "success": true }`

---

### GET /api/bins/`{id}`

Fetches a single bin by ID.

**Path parameters**: `id` (bin ID / short code)

**Response (200)**: `Bin` object.

---

### PUT /api/bins/`{id}`

Updates a bin. All fields are optional; only provided fields are changed.

**Path parameters**: `id` (bin ID)

**Request body**

| Field | Type | Description |
|---|---|---|
| `name` | string | Max 255 characters |
| `areaId` | UUID or null | Area assignment; null to unassign |
| `items` | (string \| object)[] | Replaces all existing items (up to 500). Accepts strings or `{ name, quantity? }` objects. |
| `notes` | string | Max 10,000 characters |
| `tags` | string[] | Replaces all existing tags (up to 50) |
| `icon` | string | PascalCase Lucide icon name |
| `color` | string | Color preset key |
| `cardStyle` | string | JSON-encoded card style configuration (max 500 characters) |
| `visibility` | `"location"` or `"private"` | |

**Response (200)**: Updated `Bin` object.

---

### DELETE /api/bins/`{id}`

Soft-deletes a bin by setting `deleted_at`. The bin moves to trash and can be restored.

**Path parameters**: `id` (bin ID)

**Response (200)**: `{ "message": "Bin deleted" }`

---

### POST /api/bins/`{id}`/pin

Pins a bin for the authenticated user. Idempotent. Maximum 20 pins per user per location.

**Path parameters**: `id` (bin ID)

**Response (200)**: `{ "pinned": true }`

---

### DELETE /api/bins/`{id}`/pin

Unpins a bin for the authenticated user.

**Path parameters**: `id` (bin ID)

**Response (200)**: `{ "pinned": false }`

---

### POST /api/bins/`{id}`/restore

Restores a soft-deleted bin from trash.

**Path parameters**: `id` (bin ID)

**Response (200)**: The restored `Bin` object.

---

### POST /api/bins/`{id}`/move

Moves a bin to a different location. The user must be a member of both locations. The area assignment is cleared because areas are location-scoped.

**Path parameters**: `id` (bin ID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `locationId` | UUID | Yes | Target location ID |

**Response (200)**: Updated `Bin` object in the new location.

---

### DELETE /api/bins/`{id}`/permanent

Permanently deletes a bin and removes its photos from storage. Only works on bins that are already soft-deleted (in trash).

**Path parameters**: `id` (bin ID)

**Response (200)**: `{ "message": "Bin permanently deleted" }`

---

### POST /api/bins/`{id}`/photos

Uploads a photo to a bin. Accepts JPEG, PNG, or WebP up to 5MB. Uses `multipart/form-data` with a `photo` file field.

**Path parameters**: `id` (bin ID)

**Response (201)**: The created `Photo` object.

---

### PUT /api/bins/`{id}`/add-tags

Adds tags to a bin. Merges new tags with existing ones — does not replace.

**Path parameters**: `id` (bin ID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `tags` | string[] | Yes | Up to 50 tags to add |

**Response (200)**: Updated `Bin` object.

---

### POST /api/bins/`{id}`/items

Appends items to a bin's item list.

**Path parameters**: `id` (bin ID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `items` | (string \| object)[] | Yes | Items to add. Each element can be a plain string (`"Screwdriver"`) or an object (`{ "name": "AA Battery", "quantity": 12 }`). |

**Response (201)**

```json
{
  "items": [
    { "id": "uuid", "name": "AA Battery", "quantity": 12 },
    { "id": "uuid", "name": "Flashlight", "quantity": null }
  ]
}
```

Items with no quantity specified return `quantity: null`, meaning quantity is not tracked for that item.

---

### PUT /api/bins/`{id}`/items/`{itemId}`

Renames a single item within a bin and optionally updates its quantity.

**Path parameters**: `id` (bin ID), `itemId` (item UUID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | New item name |
| `quantity` | integer or null | No | New quantity. Pass `null` to clear quantity tracking. Omit to leave unchanged. |

**Response (200)**: Updated `BinItem` object `{ id, name, quantity }`.

---

### PATCH /api/bins/`{id}`/items/`{itemId}`/quantity

Updates only the quantity of a single item. If the new quantity is 0 or negative, the item is removed from the bin.

**Path parameters**: `id` (bin ID), `itemId` (item UUID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `quantity` | integer | Yes | New quantity. 0 or negative removes the item. |

**Response (200)**

```json
{
  "id": "uuid",
  "quantity": 10,
  "removed": false
}
```

When the item is removed (quantity ≤ 0), `removed` is `true`.

---

### DELETE /api/bins/`{id}`/items/`{itemId}`

Removes a single item from a bin.

**Path parameters**: `id` (bin ID), `itemId` (item UUID)

**Response (200)**: Empty body.

---

## Item Format {#item-format}

Throughout the API, items can be provided as either:

- **String**: `"Screwdriver"` — creates an item with no quantity tracked.
- **Object**: `{ "name": "AA Battery", "quantity": 12 }` — creates an item with a tracked quantity.

When returned, every item includes all three fields:

```json
{ "id": "uuid", "name": "AA Battery", "quantity": 12 }
```

A `quantity` of `null` means the item does not track quantity. Quantity must be a positive integer (minimum 1) when set.

---

### PUT /api/bins/`{id}`/items/reorder

Reorders items within a bin.

**Path parameters**: `id` (bin ID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `item_ids` | UUID[] | Yes | Item IDs in the desired order |

**Response (200)**: Empty body.

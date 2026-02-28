---
title: TagColors
---

# TagColors

::: tip User Guide
For a user-facing walkthrough, see [Items & Tags](/guide/items-tags).
:::

Per-location color assignments for tags.

---

### GET /api/tag-colors

Lists all tag color assignments for a location.

**Query parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `location_id` | UUID | Yes | |

**Response (200)**

```json
{
  "results": [
    {
      "id": "uuid",
      "location_id": "uuid",
      "tag": "fragile",
      "color": "red-500",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "count": 5
}
```

---

### PUT /api/tag-colors

Creates or updates the color for a tag in a location (upsert).

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `locationId` | UUID | Yes | |
| `tag` | string | Yes | Tag name |
| `color` | string | Yes | Color preset key |

**Response (200)**: The saved `TagColor` object.

---

### DELETE /api/tag-colors/`{tag}`

Removes the color assignment for a tag.

**Path parameters**: `tag` (tag name)

**Query parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `location_id` | UUID | Yes | |

**Response (200)**: `{ "message": "Tag color removed" }`

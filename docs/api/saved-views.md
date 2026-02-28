---
title: SavedViews
---

# SavedViews

::: tip User Guide
Saved views are managed from the [Dashboard](/guide/dashboard).
:::

Per-user saved bin list filter and sort views (max 10 per user).

---

### GET /api/saved-views

Lists all saved views for the authenticated user.

**Response (200)**

```json
{
  "results": [
    {
      "id": "uuid",
      "name": "Garage — Unorganized",
      "search_query": "",
      "sort": "updated_at",
      "filters": { "areas": ["uuid"], "needs_organizing": true },
      "created_at": "..."
    }
  ],
  "count": 3
}
```

---

### POST /api/saved-views

Creates a new saved view. Maximum 10 per user.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Display name for the view |
| `searchQuery` | string | No | Search query to save |
| `sort` | string | No | Sort field |
| `filters` | object | No | Filter criteria as a JSON object |

**Response (201)**: The created `SavedView` object.

---

### PUT /api/saved-views/`{id}`

Renames a saved view. Must be owned by the authenticated user.

**Path parameters**: `id` (UUID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | New name |

**Response (200)**: Updated `SavedView` object.

---

### DELETE /api/saved-views/`{id}`

Deletes a saved view. Must be owned by the authenticated user.

**Path parameters**: `id` (UUID)

**Response (204)**: No content.

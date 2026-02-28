---
title: Activity
---

# Activity

Paginated location activity log.

---

### GET /api/locations/`{locationId}`/activity

Returns paginated activity log entries for a location. Entries are auto-pruned based on the location's `activity_retention_days` setting (default 90). Supports filtering by entity type and specific entity ID.

**Path parameters**: `locationId` (UUID)

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer (1–100) | 50 | Page size |
| `offset` | integer | 0 | Rows to skip for pagination |
| `entity_type` | string | — | Filter by entity type: `bin`, `photo`, `area`, `member` |
| `entity_id` | UUID | — | Filter by specific entity ID |

**Response (200)**

```json
{
  "results": [
    {
      "id": "uuid",
      "location_id": "uuid",
      "user_id": "uuid",
      "user_name": "alice",
      "display_name": "Alice",
      "action": "bin_created",
      "entity_type": "bin",
      "entity_id": "uuid",
      "entity_name": "Screws",
      "changes": null,
      "auth_method": "jwt",
      "api_key_name": null,
      "created_at": "..."
    }
  ],
  "count": 284
}
```

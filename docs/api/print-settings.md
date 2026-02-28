---
title: PrintSettings
---

# PrintSettings

::: tip User Guide
For a user-facing walkthrough, see [Print Labels](/guide/print-labels).
:::

Per-user label format and custom print dimension settings.

---

### GET /api/print-settings

Returns the authenticated user's saved label format and custom dimensions. Returns an empty object if no settings have been saved yet.

**Response (200)**

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "settings": { /* arbitrary JSON */ },
  "created_at": "...",
  "updated_at": "..."
}
```

---

### PUT /api/print-settings

Saves label format and custom dimension overrides for the authenticated user.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `settings` | object | Yes | Arbitrary JSON with label format, custom dimensions, etc. |

**Response (200)**: The saved `PrintSettings` object.

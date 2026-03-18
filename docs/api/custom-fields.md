---
title: Custom Fields
---

# Custom Fields

::: tip User Guide
For a user-facing walkthrough, see [Bins — Custom Fields](/guide/bins#custom-fields).
:::

Location-scoped custom field definitions. Custom fields appear on every bin in the location as key–value text inputs. Admin only for create/update/delete.

---

### GET /api/locations/`{locationId}`/custom-fields

Lists all custom field definitions for a location, ordered by position.

**Path parameters**: `locationId` (UUID)

**Response (200)**

```json
{
  "results": [
    {
      "id": "uuid",
      "location_id": "uuid",
      "name": "Serial Number",
      "position": 0,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "count": 3
}
```

---

### POST /api/locations/`{locationId}`/custom-fields

Creates a new custom field definition. Admin only. The field is appended to the end of the list.

**Path parameters**: `locationId` (UUID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Field name. Max 100 characters. |

**Response (201)**: The created `CustomField` object.

---

### PUT /api/locations/`{locationId}`/custom-fields/reorder

Reorders custom field definitions. Admin only.

**Path parameters**: `locationId` (UUID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `field_ids` | UUID[] | Yes | Field IDs in the desired display order |

**Response (200)**: `{ "success": true }`

---

### PUT /api/locations/`{locationId}`/custom-fields/`{fieldId}`

Updates a custom field definition (rename or reposition). Admin only.

**Path parameters**: `locationId` (UUID), `fieldId` (UUID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | No | New field name. Max 100 characters. |
| `position` | integer | No | New position (0-based) |

**Response (200)**: Updated `CustomField` object.

---

### DELETE /api/locations/`{locationId}`/custom-fields/`{fieldId}`

Deletes a custom field definition and all its per-bin values (CASCADE). Admin only.

**Path parameters**: `locationId` (UUID), `fieldId` (UUID)

**Response (204)**: No content.

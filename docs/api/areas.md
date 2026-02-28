---
title: Areas
---

# Areas

::: tip User Guide
For a user-facing walkthrough, see [Locations & Areas](/guide/locations).
:::

Named zones within a location for organizing bins.

---

### GET /api/locations/`{locationId}`/areas

Lists all areas in a location, including an `unassigned_count` of bins with no area.

**Path parameters**: `locationId` (UUID)

**Response (200)**

```json
{
  "results": [
    {
      "id": "uuid",
      "location_id": "uuid",
      "name": "Garage",
      "bin_count": 12,
      "created_by": "uuid",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "count": 4,
  "unassigned_count": 7
}
```

---

### POST /api/locations/`{locationId}`/areas

Creates a new area within a location.

**Path parameters**: `locationId` (UUID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Max 255 characters |

**Response (201)**: The created `Area` object.

---

### PUT /api/locations/`{locationId}`/areas/`{areaId}`

Renames an existing area.

**Path parameters**: `locationId` (UUID), `areaId` (UUID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Max 255 characters |

**Response (200)**: The updated `Area` object.

---

### DELETE /api/locations/`{locationId}`/areas/`{areaId}`

Deletes an area. Bins in the area become unassigned (`area_id = NULL`); they are not deleted.

**Path parameters**: `locationId` (UUID), `areaId` (UUID)

**Response (200)**: `{ "message": "Area deleted" }`

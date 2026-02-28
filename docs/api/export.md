---
title: Export
---

# Export

::: tip User Guide
For a user-facing walkthrough, see [Import & Export](/guide/import-export).
:::

Export location data as JSON, ZIP, or CSV; import V1/V2 format data.

---

### GET /api/locations/`{id}`/export

Exports all location bins as a V2 JSON document. Photos are base64-encoded and embedded within each bin's `photos` array.

**Path parameters**: `id` (location UUID)

**Response (200)**

```json
{
  "version": 2,
  "exportedAt": "2024-01-01T00:00:00Z",
  "locationName": "My Workshop",
  "bins": [
    {
      "id": "ABC123",
      "name": "Screws",
      "items": ["M3x8", "M4x10"],
      "notes": "Sorted by size",
      "tags": ["hardware"],
      "icon": "Wrench",
      "color": "blue-500",
      "shortCode": "ABC123",
      "createdAt": "...",
      "updatedAt": "...",
      "photos": [
        {
          "id": "uuid",
          "filename": "photo.jpg",
          "mimeType": "image/jpeg",
          "data": "<base64>"
        }
      ]
    }
  ]
}
```

---

### GET /api/locations/`{id}`/export/zip

Exports the location as a ZIP file containing a JSON manifest (`export.json`) and a `photos/` directory with image files.

**Path parameters**: `id` (location UUID)

**Response (200)**: Binary ZIP file (`application/zip`) as a download.

---

### GET /api/locations/`{id}`/export/csv

Exports the location as a CSV spreadsheet. Columns: `name`, `area`, `items` (semicolon-separated), `tags` (semicolon-separated), `notes`, `icon`, `color`, `id`.

**Path parameters**: `id` (location UUID)

**Response (200)**: CSV text (`text/csv`) as a download.

---

### POST /api/locations/`{id}`/import

Imports bins and photos from a V1 or V2 export document. Supports `merge` (add to existing) and `replace` (clear all bins first) modes. Creates areas from location strings in V1 format. 50MB body size limit.

**Path parameters**: `id` (location UUID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | `1` or `2` | Yes | Export format version |
| `bins` | array | Yes | Bin objects matching the format version |
| `exportedAt` | string (date-time) | No | |
| `locationName` | string | No | |
| `photos` | array | No | Photo objects |
| `mode` | `"merge"` or `"replace"` | No | Default: `"merge"` |

**Response (200)**

```json
{
  "imported": 42,
  "photos": 15
}
```

---

### POST /api/import/legacy

Imports data from the old V1 export format (freeform `contents` string instead of discrete items). Handles the `homeName` field mapping. 50MB body size limit. No location scoping — uses the authenticated user's context.

**Request body**: Same `ImportRequest` schema as above.

**Response (200)**: `{ "imported": number, "photos": number }`

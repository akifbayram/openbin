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
      "items": [
        { "name": "M3x8", "quantity": 50 },
        { "name": "M4x10", "quantity": 25 }
      ],
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

Exports the location as a CSV spreadsheet. Columns: `name`, `area`, `items` (semicolon-separated; items with quantities appear as `"Item Name (×3)"`), `tags` (semicolon-separated), `notes`, `icon`, `color`, `id`.

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
| `dryRun` | boolean | No | When `true`, returns a preview of what would be imported without creating anything. See [Dry-Run Preview](#dry-run-preview). |

**Response (200)**

```json
{
  "imported": 42,
  "photos": 15
}
```

---

### POST /api/locations/`{id}`/import/csv

Imports bins from a CSV file upload. Uses `multipart/form-data` with a `file` field. The CSV must have columns: `name`, `area`, `item`, `quantity`, `tags`. Multiple rows with the same bin name and area are grouped into a single bin.

**Path parameters**: `id` (location UUID)

**Form fields**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | CSV file |
| `mode` | `"merge"` or `"replace"` | No | Default: `"merge"` |
| `dryRun` | `"true"` or `true` | No | When set, returns a preview without importing. See [Dry-Run Preview](#dry-run-preview). |

**Response (200)**: `{ "imported": number }`

---

### POST /api/locations/`{id}`/import/zip

Imports bins and photos from a ZIP backup file. The ZIP must contain a `manifest.json` with `"format": "openbin-zip"`, a `bins/` directory with per-bin JSON files, and an optional `photos/` directory. Uses `multipart/form-data` with a `file` field.

**Path parameters**: `id` (location UUID)

**Form fields**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | ZIP file |
| `mode` | `"merge"` or `"replace"` | No | Default: `"merge"` |
| `dryRun` | `"true"` or `true` | No | When set, returns a preview without importing. See [Dry-Run Preview](#dry-run-preview). |

**Response (200)**: `{ "imported": number, "photos": number }`

---

### POST /api/import/legacy

Imports data from the old V1 export format (freeform `contents` string instead of discrete items). Maps the V1 `homeName` field to the location name context. 50MB body size limit. The target location is the authenticated user's active location.

**Request body**: Same `ImportRequest` schema as above.

**Response (200)**: `{ "imported": number, "photos": number }`

---

## Dry-Run Preview {#dry-run-preview}

All three import endpoints (JSON, CSV, and ZIP) support a dry-run mode. When you set `dryRun` to `true`, the server validates the input and returns a summary of what would happen without actually creating any bins or photos.

**Dry-run response (200)**

```json
{
  "preview": true,
  "toCreate": [
    { "name": "Screws", "itemCount": 3, "tags": ["hardware"] }
  ],
  "toSkip": [
    { "name": "Bolts", "reason": "already exists" }
  ],
  "totalBins": 2,
  "totalItems": 5
}
```

| Field | Type | Description |
|---|---|---|
| `preview` | `true` | Always `true` in a dry-run response |
| `toCreate` | array | Bins that would be created, with name, item count, and tags |
| `toSkip` | array | Bins that would be skipped (e.g. duplicates in merge mode), with the reason |
| `totalBins` | number | Total number of bins in the import payload |
| `totalItems` | number | Total number of items across all bins |

In `merge` mode, bins whose IDs already exist in the database are skipped. In `replace` mode, all bins are treated as new creates.

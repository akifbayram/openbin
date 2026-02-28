---
title: Photos
---

# Photos

::: tip User Guide
For a user-facing walkthrough, see [Photos](/guide/photos).
:::

Photo retrieval and deletion. Photo upload is on the Bins route (`POST /api/bins/{id}/photos`).

---

### GET /api/photos

Lists all photos for a bin.

**Query parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `bin_id` | UUID | Yes | |

**Response (200)**

```json
{
  "results": [
    {
      "id": "uuid",
      "bin_id": "uuid",
      "filename": "photo.jpg",
      "mime_type": "image/jpeg",
      "size": 204800,
      "storage_path": "...",
      "created_by": "uuid",
      "created_at": "..."
    }
  ],
  "count": 2
}
```

---

### GET /api/photos/`{id}`/file

Serves the full-size photo binary. Auth is required via cookie or Bearer header. Returns an immutable 1-year cache header.

**Path parameters**: `id` (photo UUID)

**Query parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `token` | string | No | JWT token as an alternative to the Authorization header |

**Response (200)**: Binary image (`image/*`).

::: tip Thumbnail
A 600px WebP thumbnail is generated lazily on first request at `GET /api/photos/{id}/thumb` (not yet in the OpenAPI spec). Use `getPhotoThumbUrl(photoId)` in the frontend helpers.
:::

---

### DELETE /api/photos/`{id}`

Deletes a photo record and removes the file from storage.

**Path parameters**: `id` (photo UUID)

**Response (200)**: `{ "message": "Photo deleted" }`

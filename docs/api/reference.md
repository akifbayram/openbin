---
title: API Reference
---

# API Reference

::: tip Full Spec
For the complete OpenAPI 3.0 specification including all schemas and examples, see [`server/openapi.yaml`](https://github.com/akifbayram/openbin/blob/main/server/openapi.yaml) or run the app and visit `/api-docs/` (requires nginx proxy configuration).
:::

## Auth

Registration, login, profile management, avatar upload, token refresh, and account deletion.

---

### GET /api/auth/status

Returns server configuration flags relevant to the auth UI. No authentication required.

**Response**

```json
{
  "registrationEnabled": true
}
```

---

### POST /api/auth/register

Creates a new user account. Rate limited to 3 per hour. Returns 403 if registration is disabled via the `REGISTRATION_ENABLED` environment variable.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `username` | string | Yes | 3–50 characters |
| `password` | string | Yes | Min 8 characters; must contain uppercase, lowercase, and a digit |
| `displayName` | string | Yes | 1–100 characters |

**Response (201)**

```json
{
  "token": "<jwt>",
  "user": { "id": "...", "username": "alice", "displayName": "Alice", ... },
  "activeLocationId": null
}
```

Sets `openbin-access` and `openbin-refresh` httpOnly cookies.

---

### POST /api/auth/login

Authenticates with username and password. Rate limited to 5 per 15 minutes.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `username` | string | Yes | |
| `password` | string | Yes | |

**Response (200)**

Same shape as the register response: `{ token, user, activeLocationId }`. Sets auth cookies.

---

### POST /api/auth/refresh

Rotates the refresh token. Reads the `openbin-refresh` httpOnly cookie, validates and revokes the old token, and issues a new access + refresh token pair as cookies. No Authorization header required (the access token may be expired).

::: warning Replay protection
If a previously-revoked refresh token is presented, the entire token family is revoked and all sessions for the user are terminated.
:::

**Response (200)**: `{ "message": "Token refreshed" }` with new cookies set.

---

### POST /api/auth/logout

Revokes the current refresh token from the `openbin-refresh` cookie and clears auth cookies. No authentication required.

**Response (200)**: `{ "message": "Logged out" }`

---

### POST /api/auth/logout-all

Revokes all refresh tokens for the authenticated user, logging out every device simultaneously.

**Response (200)**: `{ "message": "All sessions logged out" }`

---

### GET /api/auth/me

Returns the authenticated user's profile plus the persisted active location selection.

**Response (200)**

```json
{
  "id": "uuid",
  "username": "alice",
  "displayName": "Alice",
  "email": null,
  "avatarUrl": null,
  "activeLocationId": "uuid-or-null",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

---

### PUT /api/auth/active-location

Persists the user's active location selection. The location is validated for membership.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `locationId` | string (UUID) or null | Yes | Location to set as active, or null to clear |

**Response (200)**: `{ "activeLocationId": "uuid-or-null" }`

---

### PUT /api/auth/profile

Updates the authenticated user's display name and/or email.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `displayName` | string | No | Max 100 characters |
| `email` | string (email) | No | |

**Response (200)**: Updated `User` object.

---

### PUT /api/auth/password

Changes the authenticated user's password.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `currentPassword` | string | Yes | |
| `newPassword` | string | Yes | Min 8 characters; must contain uppercase, lowercase, and a digit |

**Response (200)**: `{ "message": "Password updated" }`

---

### POST /api/auth/avatar

Uploads an avatar image. Accepts JPEG, PNG, or WebP up to 2MB. Uses `multipart/form-data` with a `avatar` file field.

**Response (200)**: `{ "avatarUrl": "/api/auth/avatar/<userId>" }`

---

### DELETE /api/auth/avatar

Removes the authenticated user's avatar.

**Response (200)**: `{ "message": "Avatar removed" }`

---

### GET /api/auth/avatar/`{userId}`

Serves an avatar image file. Returns the binary image with appropriate content-type.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `userId` | UUID | |

**Response (200)**: Binary image (`image/*`).

---

### DELETE /api/auth/account

Permanently deletes the authenticated user's account. Requires password confirmation. Cascades to sole-owned locations (and their bins, photos, tag colors). Shared locations are preserved.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `password` | string | Yes | Current password for confirmation |

**Response (200)**: `{ "message": "Account deleted" }`

---

## Locations

Location CRUD, membership management, and invite codes.

---

### GET /api/locations

Returns all locations the authenticated user belongs to, including member count, bin count, area count, and the user's role.

**Response (200)**

```json
{
  "results": [
    {
      "id": "uuid",
      "name": "My Workshop",
      "invite_code": "abc123",
      "role": "admin",
      "member_count": 3,
      "bin_count": 42,
      "area_count": 5,
      "activity_retention_days": 90,
      "trash_retention_days": 30,
      "app_name": "OpenBin",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "count": 1
}
```

---

### POST /api/locations

Creates a new location and adds the authenticated user as owner (admin).

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Max 255 characters |

**Response (201)**: The created `Location` object.

---

### POST /api/locations/join

Joins a location using an invite code. Rate limited to 10 per 15 minutes.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `inviteCode` | string | Yes | Invite code for the target location |

**Response (200)**: The joined `Location` object.

---

### PUT /api/locations/`{id}`

Updates a location's settings. Admin only.

**Path parameters**: `id` (UUID)

**Request body**

| Field | Type | Description |
|---|---|---|
| `name` | string | Max 255 characters |
| `activity_retention_days` | integer (7–365) | Days to keep activity log entries |
| `trash_retention_days` | integer (7–365) | Days to keep soft-deleted bins before purging |
| `app_name` | string | Custom display name for this location |

**Response (200)**: Updated `Location` object.

---

### DELETE /api/locations/`{id}`

Permanently deletes a location and all its data (bins, photos, areas, tag colors, activity log). Admin only.

**Path parameters**: `id` (UUID)

**Response (200)**: `{ "message": "Location deleted" }`

---

### GET /api/locations/`{id}`/members

Lists all members of a location.

**Path parameters**: `id` (UUID)

**Response (200)**

```json
{
  "results": [
    {
      "id": "uuid",
      "location_id": "uuid",
      "user_id": "uuid",
      "role": "admin",
      "joined_at": "...",
      "display_name": "Alice"
    }
  ],
  "count": 3
}
```

---

### DELETE /api/locations/`{id}`/members/`{userId}`

Removes a member from a location. Admins can remove any member. Regular members can only remove themselves (leave). The last admin cannot leave.

**Path parameters**: `id` (location UUID), `userId` (user UUID)

**Response (200)**: `{ "message": "Member removed" }`

---

### PUT /api/locations/`{id}`/members/`{userId}`/role

Changes a member's role. Admin only. Cannot demote the last admin.

**Path parameters**: `id` (location UUID), `userId` (user UUID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `role` | `"admin"` or `"member"` | Yes | |

**Response (200)**: `{ "message": "Role updated to admin" }`

---

### POST /api/locations/`{id}`/regenerate-invite

Generates a new invite code for the location. Admin only. Invalidates the previous code immediately.

**Path parameters**: `id` (UUID)

**Response (200)**: `{ "invite_code": "xyz789" }`

---

## Areas

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

---

## Bins

Bin CRUD, soft delete, restore, permanent deletion, QR lookup, items, tags, pinning, and photo upload.

---

### POST /api/bins

Creates a new bin. The bin ID is an auto-generated 6-character alphanumeric short code (charset excludes ambiguous characters: `0`, `O`, `1`, `l`, `I`).

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Max 255 characters |
| `locationId` | UUID | Yes | Location to create the bin in |
| `items` | string[] | No | Up to 500 initial items |
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
| `items` | string[] | Replaces all existing items (up to 500) |
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
| `items` | string[] | Yes | Item names to add |

**Response (201)**

```json
{
  "items": [
    { "id": "uuid", "name": "Phillips screwdriver" }
  ]
}
```

---

### PUT /api/bins/`{id}`/items/`{itemId}`

Renames a single item within a bin.

**Path parameters**: `id` (bin ID), `itemId` (item UUID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | New item name |

**Response (200)**: Updated `BinItem` object `{ id, name }`.

---

### DELETE /api/bins/`{id}`/items/`{itemId}`

Removes a single item from a bin.

**Path parameters**: `id` (bin ID), `itemId` (item UUID)

**Response (200)**: Empty body.

---

### PUT /api/bins/`{id}`/items/reorder

Reorders items within a bin.

**Path parameters**: `id` (bin ID)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `item_ids` | UUID[] | Yes | Item IDs in the desired order |

**Response (200)**: Empty body.

---

## Photos

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

---

## TagColors

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

---

## PrintSettings

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

---

## Export

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

---

## AI

AI provider configuration, photo analysis, text structuring, natural language commands, inventory queries, and server-side command execution.

---

### GET /api/ai/settings

Returns the authenticated user's configured AI provider. The API key is masked in the response. Returns null if no AI has been configured.

**Response (200)**

```json
{
  "id": "uuid",
  "provider": "openai",
  "apiKey": "sk-•••••••••",
  "model": "gpt-4o",
  "endpointUrl": null,
  "customPrompt": null,
  "commandPrompt": null,
  "queryPrompt": null,
  "structurePrompt": null,
  "source": "user",
  "providerConfigs": { /* per-provider cached credentials */ }
}
```

---

### PUT /api/ai/settings

Saves AI provider configuration. The API key is encrypted at rest when the `AI_ENCRYPTION_KEY` environment variable is set. Rate limited to 30 per hour.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | `"openai"`, `"anthropic"`, `"gemini"`, `"openai-compatible"` | Yes | |
| `apiKey` | string | Yes | Provider API key |
| `model` | string | Yes | Model identifier (e.g. `gpt-4o`) |
| `endpointUrl` | string | No | Required when `provider` is `"openai-compatible"` |
| `customPrompt` | string or null | No | Custom system prompt for image analysis. Max 10,000 characters. Use `{available_tags}` placeholder to inject existing tags. |
| `commandPrompt` | string or null | No | Custom system prompt for natural language commands. Max 10,000 characters. |
| `queryPrompt` | string or null | No | Custom system prompt for inventory queries. Max 10,000 characters. |
| `structurePrompt` | string or null | No | Custom system prompt for item extraction from text/voice. Max 10,000 characters. |

**Response (200)**: Saved `AiSettings` object.

---

### DELETE /api/ai/settings

Removes the authenticated user's AI provider configuration.

**Response (200)**: `{ "message": "AI settings deleted" }`

---

### POST /api/ai/analyze

Sends one or more stored photos (already uploaded to a bin) to the configured AI provider for analysis. Returns suggested bin name, items, tags, and notes. Maximum 5 photos per request. Rate limited to 30 per hour.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `photoId` | UUID | No | Single photo ID to analyze |
| `photoIds` | UUID[] | No | Multiple photo IDs (max 5). Takes precedence over `photoId`. |

**Response (200)**

```json
{
  "name": "Power Tools",
  "items": ["Cordless drill", "Jigsaw", "Sander"],
  "tags": ["tools", "electric"],
  "notes": "Stored in the original cases"
}
```

---

### POST /api/ai/analyze-image

Directly uploads images for AI analysis without storing them first. Used during onboarding. Accepts up to 5 images, 5MB each, via `multipart/form-data` with a `photos` file field. Rate limited to 30 per hour.

**Response (200)**: Same `AiSuggestions` shape as `/ai/analyze`.

---

### POST /api/ai/test

Validates that AI credentials work by making a test call to the provider.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | string | Yes | Provider name |
| `apiKey` | string | Yes | API key to test |
| `model` | string | Yes | Model to test |
| `endpointUrl` | string | No | Required for `openai-compatible` |

**Response (200)**: `{ "success": true, "message": "Connection successful" }`

---

### POST /api/ai/structure-text

Sends raw dictated or typed text to the AI provider, which extracts and normalizes it into a clean list of inventory items. Handles filler words, quantity normalization, and deduplication. Rate limited to 30 per hour.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | string | Yes | Raw text to structure. Max 5,000 characters. |
| `mode` | `"items"` | No | Structuring mode. Only `"items"` is currently supported. |
| `context.binName` | string | No | Name of the bin for context |
| `context.existingItems` | string[] | No | Items already in the bin (excluded from results) |

**Response (200)**

```json
{
  "items": ["Phillips screwdriver", "Flat-head screwdriver", "Allen key set"]
}
```

---

### POST /api/ai/command

Parses a natural language command into structured inventory actions for client-side preview and execution. The client is responsible for displaying the parsed actions to the user before executing them via existing mutation endpoints. Rate limited to 30 per hour.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | string | Yes | Natural language command. Max 5,000 characters. |
| `locationId` | string | Yes | Location ID to scope the command context |

**Response (200)**

```json
{
  "actions": [
    { "type": "add_items", "bin_id": "...", "items": ["AAA batteries"] },
    { "type": "add_tags", "bin_id": "...", "tags": ["consumables"] }
  ],
  "interpretation": "Add AAA batteries to the Electronics bin and tag it as consumables"
}
```

Supported action types: `add_items`, `remove_items`, `modify_item`, `create_bin`, `delete_bin`, `add_tags`, `remove_tags`, `modify_tag`, `set_area`, `set_notes`, `set_icon`, `set_color`.

---

### POST /api/ai/query

Read-only endpoint that answers natural language questions about the inventory. Returns a natural language answer plus structured matches with bin details. Ideal for smart home integrations.

Rate limits: 30/hour for JWT auth; 1,000/hour for API keys.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `question` | string | Yes | Natural language question. Max 5,000 characters. |
| `locationId` | UUID | Yes | Location to search within |

**Response (200)**

```json
{
  "answer": "AAA batteries are in the Electronics bin (Garage area).",
  "matches": [
    {
      "bin_id": "uuid",
      "name": "Electronics",
      "area_name": "Garage",
      "items": ["AAA batteries", "AA batteries"],
      "tags": ["consumables"],
      "relevance": "Contains the item you asked about"
    }
  ]
}
```

---

### POST /api/ai/execute

Headless fire-and-forget endpoint. Parses a natural language command and executes all resulting actions server-side in a single transaction. Unlike `/ai/command` (which returns actions for client-side preview), this endpoint performs the mutations directly. Ideal for smart home integrations and automation pipelines.

Rate limits: 30/hour for JWT auth; 1,000/hour for API keys.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | string | Yes | Natural language command. Max 5,000 characters. |
| `locationId` | UUID | Yes | Location to execute the command in |

**Response (200)**

```json
{
  "executed": [
    {
      "type": "add_items",
      "success": true,
      "details": "Added [AAA batteries] to Electronics",
      "bin_id": "uuid",
      "bin_name": "Electronics"
    }
  ],
  "interpretation": "Added AAA batteries to the Electronics bin",
  "errors": []
}
```

---

## Activity

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

---

## ApiKeys

API key creation, listing, and revocation for headless access.

---

### GET /api/api-keys

Lists the authenticated user's active (non-revoked) API keys. The full key value is never returned after creation.

**Response (200)**

```json
{
  "results": [
    {
      "id": "uuid",
      "key_prefix": "sk_openbin_abc123",
      "name": "Home Assistant",
      "created_at": "...",
      "last_used_at": "...",
      "revoked_at": null
    }
  ],
  "count": 2
}
```

---

### POST /api/api-keys

Creates a new API key. The full key is returned **only once** in this response and cannot be retrieved later. Maximum 10 active keys per user. Keys use the format `sk_openbin_<64 hex chars>`.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | No | A human-readable label. Max 255 characters. |

**Response (201)**

```json
{
  "id": "uuid",
  "key": "sk_openbin_<64 hex chars>",
  "keyPrefix": "sk_openbin_abc123",
  "name": "Home Assistant"
}
```

::: warning Save the key now
The full API key is only returned at creation time. Store it securely — it cannot be retrieved again.
:::

---

### DELETE /api/api-keys/`{id}`

Revokes an API key by setting `revoked_at`. The key stops working immediately.

**Path parameters**: `id` (API key UUID)

**Response (200)**: `{ "message": "Key revoked" }`

---

## UserPreferences

Arbitrary per-user application preference storage.

---

### GET /api/user-preferences

Returns the authenticated user's application preferences as a JSON object. Returns null if no preferences have been saved.

**Response (200)**: Arbitrary JSON preferences object, or null.

---

### PUT /api/user-preferences

Saves application preferences for the authenticated user. Creates or updates the existing record.

**Request body**: Any valid JSON object with preference key-value pairs.

**Response (200)**: The saved preferences object.

---

## SavedViews

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

---

## ScanHistory

Per-user QR code scan history.

---

### GET /api/scan-history

Returns the authenticated user's recent QR scan history, ordered by most recent first.

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer (1–100) | 20 | Maximum number of entries to return |

**Response (200)**

```json
{
  "results": [
    {
      "id": "uuid",
      "bin_id": "uuid",
      "scanned_at": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 8
}
```

---

### POST /api/scan-history

Records a bin scan. If the bin was previously scanned, updates the timestamp rather than creating a duplicate entry. Automatically trims history to a maximum of 100 entries.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `binId` | UUID | Yes | The bin that was scanned |

**Response (201)**: `{ "ok": true }`

---

### DELETE /api/scan-history

Clears all scan history entries for the authenticated user.

**Response (204)**: No content.

---

## Batch

Execute up to 50 bin operations atomically in a single request.

---

### POST /api/batch

Executes multiple bin operations in one transaction. Uses a partial-success model: individual operation failures are reported in the `errors` array while the remaining successful operations are committed. Ideal for AI agents, MCP integrations, and bulk workflows.

Rate limits: 60/hour for JWT auth; 600/hour for API keys.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `locationId` | UUID | Yes | Location to execute operations in |
| `operations` | array | Yes | 1–50 operation objects |

**Operation object fields**

| Field | Type | Applicable to | Description |
|---|---|---|---|
| `type` | string | All | Operation type (see below) |
| `bin_id` | UUID | All except `create_bin` | Target bin ID |
| `bin_name` | string | All except `create_bin` | Bin name (for logging) |
| `name` | string | `create_bin`, `update_bin` | Bin name |
| `items` | string[] | `add_items`, `remove_items`, `create_bin` | Item names |
| `tags` | string[] | `add_tags`, `remove_tags`, `create_bin`, `update_bin` | Tag names |
| `notes` | string | `set_notes`, `create_bin`, `update_bin` | Notes text |
| `mode` | `"set"`, `"append"`, `"clear"` | `set_notes` | Notes update mode |
| `area_id` | UUID or null | `set_area` | Area UUID; null to unassign |
| `area_name` | string | `set_area`, `create_bin`, `update_bin` | Area name; auto-creates if needed |
| `icon` | string | `set_icon`, `create_bin`, `update_bin` | Icon identifier |
| `color` | string | `set_color`, `create_bin`, `update_bin` | Color value |
| `old_item` | string | `modify_item` | Current item name to rename |
| `new_item` | string | `modify_item` | New item name |
| `old_tag` | string | `modify_tag` | Current tag name to rename |
| `new_tag` | string | `modify_tag` | New tag name |
| `visibility` | `"location"` or `"private"` | `update_bin` | Bin visibility |

**Supported operation types**: `create_bin`, `update_bin`, `delete_bin`, `restore_bin`, `add_items`, `remove_items`, `modify_item`, `add_tags`, `remove_tags`, `modify_tag`, `set_area`, `set_notes`, `set_icon`, `set_color`.

**Example request**

```json
{
  "locationId": "550e8400-e29b-41d4-a716-446655440000",
  "operations": [
    {
      "type": "add_tags",
      "bin_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "bin_name": "Tools",
      "tags": ["fragile"]
    },
    {
      "type": "set_area",
      "bin_id": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "bin_name": "Supplies",
      "area_name": "Garage"
    },
    {
      "type": "create_bin",
      "name": "New Bin",
      "items": ["item1"],
      "tags": ["new"]
    }
  ]
}
```

**Response (200)**

```json
{
  "results": [
    {
      "type": "add_tags",
      "success": true,
      "details": "Added tags [fragile] to Tools",
      "bin_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "bin_name": "Tools"
    },
    {
      "type": "set_area",
      "success": true,
      "details": "Set area of Supplies to \"Garage\"",
      "bin_id": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "bin_name": "Supplies"
    },
    {
      "type": "create_bin",
      "success": true,
      "details": "Created bin \"New Bin\"",
      "bin_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "bin_name": "New Bin"
    }
  ],
  "errors": []
}
```

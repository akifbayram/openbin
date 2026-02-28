---
title: Locations
---

# Locations

::: tip User Guide
For a user-facing walkthrough, see [Locations & Areas](/guide/locations).
:::

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

---
title: Auth
---

# Auth

::: tip User Guide
For account and profile management, see [Account & Profile](/guide/profile).
:::

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

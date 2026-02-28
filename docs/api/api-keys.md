---
title: ApiKeys
---

# ApiKeys

::: tip User Guide
For a user-facing walkthrough, see [API Keys](/guide/api-keys).
:::

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

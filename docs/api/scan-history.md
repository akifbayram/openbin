---
title: ScanHistory
---

# ScanHistory

::: tip User Guide
For a user-facing walkthrough, see [QR Scanning](/guide/qr-scanning).
:::

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

---
title: UserPreferences
---

# UserPreferences

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

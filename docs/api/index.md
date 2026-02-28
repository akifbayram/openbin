---
title: API Overview
---

# API Overview

OpenBin exposes a REST API under `/api`. The full OpenAPI 3.0 spec is at
[`server/openapi.yaml`](https://github.com/akifbayram/openbin/blob/main/server/openapi.yaml) in the repository.

## Base URL

| Environment | URL |
|---|---|
| Docker (default) | `http://localhost:1453/api` |
| Local development | `http://localhost:3000/api` |
| Production | `https://your-domain.com/api` |

## Authentication

Three authentication methods are supported. Use the one that fits your use case.

### 1. httpOnly Cookies (browser sessions)

This is the primary authentication method used by the OpenBin web app. On a successful login or registration, the server sets two httpOnly cookies:

- `openbin-access` — short-lived JWT access token (15-minute expiry)
- `openbin-refresh` — long-lived refresh token (7-day expiry)

Browsers automatically include these cookies on every same-origin request. Cross-origin requests must include `credentials: 'include'`. The refresh token is rotated automatically via `POST /api/auth/refresh`. If a revoked refresh token is replayed, the entire token family is invalidated as a security measure.

### 2. Bearer Token (JWT)

The JWT token returned in the `token` field of the login and register response body can be used directly as a Bearer token:

```http
Authorization: Bearer <jwt-token>
```

This method is provided for backward compatibility and for clients that cannot use cookies.

### 3. API Key

Long-lived API keys (format: `sk_openbin_<64 hex chars>`) can be created via `POST /api/api-keys` and used in the same Authorization header format:

```http
Authorization: Bearer sk_openbin_...
```

API keys are intended for automation, scripts, and integrations such as smart home systems. They never expire unless explicitly revoked. See the [API Keys guide](/guide/api-keys) for details on creating and managing keys.

## Response Envelopes

### List responses

All list endpoints return a consistent envelope:

```json
{
  "results": [...],
  "count": 42
}
```

When pagination is used (i.e., a `limit` query parameter is provided), `count` reflects the **total number of matching rows** across all pages. Without pagination, `count` equals `results.length`.

### Error responses

All errors use a consistent envelope with a machine-readable code and a human-readable message:

```json
{
  "error": "NOT_FOUND",
  "message": "Bin not found"
}
```

| Error Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Request body or parameters failed validation |
| `NOT_FOUND` | 404 | The requested resource does not exist |
| `FORBIDDEN` | 401 / 403 | Authentication required or insufficient permissions |
| `CONFLICT` | 409 | Resource already exists (e.g. duplicate username) |
| `RATE_LIMITED` | 429 | Too many requests — back off and retry |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Rate Limiting

Rate limiting is applied to sensitive endpoints to prevent abuse:

- **Registration** (`POST /auth/register`): 3 attempts per hour
- **Login** (`POST /auth/login`): 5 attempts per 15 minutes
- **Token refresh** (`POST /auth/refresh`): limited per IP
- **Join location** (`POST /locations/join`): 10 per 15 minutes
- **AI endpoints**: 30 per hour for JWT auth; higher limits for API keys
- **Batch operations**: 60 per hour for JWT; 600 per hour for API keys

::: tip Development
Set the `DISABLE_RATE_LIMIT=true` environment variable to disable all rate limiters during local development and testing.
:::

## API Groups

| Tag | Description |
|---|---|
| **Auth** | Registration, login, logout, profile management, avatar, token refresh, account deletion |
| **Locations** | Location CRUD, membership management, and invite codes |
| **Areas** | Named zones within a location for organizing bins |
| **Bins** | Bin CRUD, soft deletes, restore, QR lookup, items, tags, pinning, and photo upload |
| **Photos** | Photo retrieval (file and thumbnail) and deletion |
| **TagColors** | Per-location color assignments for tags |
| **PrintSettings** | Per-user label format and custom print dimension settings |
| **Export** | Export location data as JSON, ZIP, or CSV; import V1/V2 format data |
| **AI** | AI provider configuration, photo analysis, natural language commands, and inventory queries |
| **Activity** | Paginated location activity log |
| **ApiKeys** | API key creation, listing, and revocation for headless access |
| **UserPreferences** | Arbitrary per-user application preference storage |
| **SavedViews** | Per-user saved bin list filter and sort views |
| **ScanHistory** | Per-user QR code scan history |
| **Batch** | Execute up to 50 bin operations atomically in a single request |

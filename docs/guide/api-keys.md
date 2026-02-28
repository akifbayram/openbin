# API Keys

API keys let you access OpenBin's API without a browser login session. They are useful for scripts, automation, home integrations, and any headless access to your inventory data.

## Creating a Key

1. Go to **Settings → API Keys**.
2. Click **Create Key**.
3. Enter a descriptive name (e.g. "Home automation script", "Backup script").
4. Click **Create**.
5. **Copy the key immediately** — it is shown only once and cannot be retrieved again.

## Key Format

All API keys follow this format:

```
sk_openbin_<random>
```

## Using a Key

Include the key in the `Authorization` header on any API request:

```http
GET /api/bins HTTP/1.1
Host: your-openbin-instance.example.com
Authorization: Bearer sk_openbin_abc123...
```

API keys work with all endpoints that support JWT authentication. The server identifies the request as coming from an API key (not a browser session) and records `auth_method: api_key` in the activity log.

### Example with curl

```bash
curl -H "Authorization: Bearer sk_openbin_abc123..." \
     https://your-openbin-instance.example.com/api/bins
```

### Example with fetch

```js
const res = await fetch('/api/bins', {
  headers: {
    'Authorization': 'Bearer sk_openbin_abc123...'
  }
});
const data = await res.json();
```

## Revoking a Key

1. Go to **Settings → API Keys**.
2. Find the key you want to disable.
3. Click **Revoke**.

Revoked keys stop working immediately. Revocation cannot be undone — if you need access again, create a new key.

## Viewing Active Keys

The API Keys settings page lists all your active keys with:

- Key name
- Key prefix (first few characters — for identification)
- Creation date
- Last used date (or "Never" if unused)

The full key value is never shown again after creation.

## Key vs. JWT Token

| | JWT Token | API Key |
|---|---|---|
| Lifetime | Short-lived (access token) + refresh cycle | Until revoked |
| Use case | Browser sessions | Scripts, automation, integrations |
| Format | `eyJ...` (JWT) | `sk_openbin_...` |
| Created by | Login flow | Settings → API Keys |
| Stored in | HttpOnly cookie | Your environment / secret manager |

::: warning Security Best Practices
- Store API keys in environment variables or a secret manager — never in source code.
- Never commit API keys to version control.
- Use a separate key per application or script so you can revoke one without affecting others.
- Revoke compromised keys immediately.
- API keys are long-lived by design — rotate them periodically for sensitive automations.
:::

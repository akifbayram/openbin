# Configuration Reference

No configuration is required to get started. All variables have safe defaults. Create a `.env` file in the project root to override any of them.

```bash
cp .env.example .env
```

Uncomment only the lines you need to change. The file is loaded automatically by Docker Compose and by the Express server at startup.

---

### Docker

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST_PORT` | `1453` | Externally-exposed port that maps to the container's internal port. Change this to run OpenBin on a different host port. |

---

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `1453` | Internal Express server port. Rarely needs changing unless you have a port conflict inside the container. |

---

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | _(auto-generated)_ | JWT signing secret. Auto-generated on first run and persisted to `/data/.jwt_secret` if unset. Set explicitly to keep sessions valid across container rebuilds. |
| `JWT_EXPIRES_IN` | `7d` | Legacy token lifetime used for API key compatibility. |
| `ACCESS_TOKEN_EXPIRES_IN` | `15m` | Lifetime of the short-lived access token stored in an httpOnly cookie. |
| `REFRESH_TOKEN_MAX_DAYS` | `7` | Refresh token lifetime in days. Accepted range: 1–90. |
| `COOKIE_SECURE` | _(auto)_ | Forces the `Secure` flag on cookies. Defaults to `true` in production automatically. Set explicitly if needed. |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost factor. Range: 4–31. Higher values are more secure but slower. |
| `REGISTRATION_ENABLED` | `true` | Set to `false` to disable new user registration. Existing users can still log in. |

---

### Upload Limits

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_PHOTO_SIZE_MB` | `5` | Maximum size per photo upload in megabytes. Accepted range: 1–50. |
| `MAX_AVATAR_SIZE_MB` | `2` | Maximum size per avatar upload in megabytes. Accepted range: 1–10. |

---

### AI Provider (server-wide fallback)

When set, all users get AI features without needing to configure their own API keys. Individual users can still override with their own settings in their profile.

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | _(unset)_ | AI provider to use. Accepted values: `openai`, `anthropic`, `gemini`, `openai-compatible`. |
| `AI_API_KEY` | _(unset)_ | API key for the configured provider. |
| `AI_MODEL` | _(unset)_ | Model name to use. Examples: `gpt-4o`, `claude-sonnet-4-5-20250514`, `gemini-2.0-flash`. |
| `AI_ENDPOINT_URL` | _(unset)_ | Custom endpoint URL. Required only when `AI_PROVIDER=openai-compatible` (e.g. `http://localhost:11434/v1` for Ollama). |

::: info Supported providers
OpenBin supports OpenAI, Anthropic (Claude), Google Gemini, and any OpenAI-compatible API such as Ollama or LM Studio. Each user can also configure their own key independently via their profile settings.
:::

---

### AI Encryption

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_ENCRYPTION_KEY` | _(unset)_ | Encrypts user AI API keys at rest using AES-256-GCM. Generate a key with `openssl rand -base64 32`. If unset, API keys are stored in plaintext. |

::: tip Generating an encryption key
```bash
openssl rand -base64 32
```
Copy the output into your `.env` file as `AI_ENCRYPTION_KEY=<value>`. Do not change this value after users have saved API keys, or the existing keys will become unreadable.
:::

---

### Backups

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_ENABLED` | `false` | Set to `true` to enable automatic database backups. |
| `BACKUP_INTERVAL` | `daily` | Backup schedule. See [Backup Schedule Formats](#backup-schedule-formats) below. |
| `BACKUP_RETENTION` | `7` | Number of days to keep backup files before they are automatically deleted. Accepted range: 1–365. |
| `BACKUP_WEBHOOK_URL` | _(unset)_ | Optional URL that receives a POST request on backup failure. Payload: `{ event, error, timestamp }`. |

Backup files are written to `/data/backups/` inside the container (`BACKUP_PATH` in docker-compose.yml maps to the `api_data` volume).

---

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `DISABLE_RATE_LIMIT` | `false` | Set to `true` to disable all rate limiters. Useful in development or automated test environments. Do not disable in production. |

---

### Advanced

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin for API requests. Only relevant for non-Docker local development where the frontend and API run on different origins. |
| `TRUST_PROXY` | `false` | Set to `true` when running behind a reverse proxy such as Nginx or Caddy. Required for correct IP detection in rate limiting and for the `Secure` cookie flag to work over HTTPS. |

---

## Backup Schedule Formats

The `BACKUP_INTERVAL` variable accepts the following values:

| Value | Behavior |
|-------|----------|
| `hourly` | Runs a backup every hour |
| `daily` | Runs a backup once per day at midnight |
| `weekly` | Runs a backup once per week |
| Custom cron expression | Any valid 5-field cron expression |

**Custom cron examples:**

```
0 3 * * *       # Every day at 3:00 AM
0 */6 * * *     # Every 6 hours
0 2 * * 0       # Every Sunday at 2:00 AM
```

::: tip
Use a tool like [crontab.guru](https://crontab.guru/) to build and verify cron expressions.
:::

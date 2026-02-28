---
title: AI
---

# AI

::: tip User Guide
For a user-facing walkthrough, see [AI Features](/guide/ai).
:::

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

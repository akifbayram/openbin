---
prev:
  text: 'Photos'
  link: '/guide/photos'
next:
  text: 'Bulk Add'
  link: '/guide/bulk-add'
---

# AI Features

OpenBin's AI features are fully optional. They require connecting your own API key or having an admin configure a server-wide key. Without an AI key, all other features work normally.

## Supported Providers

| Provider | Recommended Model |
|---|---|
| **[OpenAI](https://platform.openai.com/)** | `gpt-5-mini` |
| **[Anthropic](https://console.anthropic.com/)** | `claude-sonnet-4-6` |
| **[Google Gemini](https://aistudio.google.com/)** | `gemini-3-flash-preview` |
| **OpenAI-compatible** | — |

### Getting an API Key

Each provider requires its own API key. Sign up and create one from their developer platform:

- **OpenAI** — Create an account at [platform.openai.com](https://platform.openai.com/), then go to **API Keys** to generate a key. Requires adding billing credits. [Models & pricing →](https://platform.openai.com/docs/pricing)
- **Anthropic** — Create an account at [console.anthropic.com](https://console.anthropic.com/), set up billing under **Settings → Billing**, then go to **API Keys → Create Key**. [Models & pricing →](https://docs.anthropic.com/en/docs/about-claude/pricing)
- **Google Gemini** — Sign in at [aistudio.google.com](https://aistudio.google.com/) with a Google account, then click **Get API key → Create API key**. Includes a free tier with no billing required. [Models & pricing →](https://ai.google.dev/gemini-api/docs/pricing)

## Per-User Setup

1. Go to **Settings → AI**.
2. Select your provider.
3. Enter your API key (see [Getting an API Key](#getting-an-api-key) above).
4. Select or type the model name (see [Recommended Models](#recommended-models) for suggestions).
5. For OpenAI-compatible endpoints, enter the endpoint URL.
6. Click **Save**.

AI features activate immediately after saving.

## Server-Wide Setup (Admin)

Admins can configure a shared AI key via environment variables so all users get AI features without individual setup:

```ini
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-5-mini
# For OpenAI-compatible endpoints:
AI_ENDPOINT_URL=https://your-endpoint.example.com/v1
```

Users can still configure their own keys in Settings → AI, which takes precedence over the server-wide key.

::: info
Set `AI_ENCRYPTION_KEY` to an AES-256-GCM key to encrypt stored API keys at rest. Without this, keys are stored as plaintext in the database.
:::

## Photo Analysis

1. Open a bin → **Photos** tab.
2. Upload a photo of the bin's contents.
3. Tap **Analyze with AI**.
4. Review the AI's suggestions: bin name, items list, tags, and notes.
5. Apply any or all suggestions — each field can be accepted or dismissed independently.

Photo analysis is useful for quickly populating a bin's metadata from a single photo without typing everything manually.

## Natural Language Commands

The AI command bar (accessible from the bin list) accepts natural language instructions:

```
Add screwdriver to the tools bin
Move batteries to the garage area
Create a bin called Holiday Decorations with items: lights, ornaments, wrapping paper
Remove the extension cord from the electrical bin
```

OpenBin interprets the command, shows a preview of the action it will take, and asks for confirmation before making any changes.

## Inventory Search

Ask natural language questions to search across all bins:

```
Where did I put the holiday lights?
Which bins have batteries?
What's in the attic?
Do I have any sandpaper?
```

OpenBin searches your bins and returns matching results with an explanation of why each bin matched.

## Custom Prompts

Advanced users can override the default AI prompts for each operation:

1. Go to **Settings → AI → Advanced**.
2. Enter a custom prompt for photo analysis, commands, search queries, or text structuring.
3. Save.

Custom prompts are useful for domain-specific terminology, non-English languages, or specialized inventory contexts.

::: tip
Leave a custom prompt field blank to use the built-in default for that operation.
:::

## Temperature and Token Settings

The advanced AI settings section exposes fine-tuning parameters:

| Parameter | Effect |
|---|---|
| Temperature | Controls randomness. Lower = more deterministic. Range: 0.0–2.0 |
| Max tokens | Caps the response length. |
| Top-p | Nucleus sampling probability. Lower = more focused output. |
| Request timeout | Seconds to wait before aborting an AI request. |

These settings apply per provider configuration.

## Related

- [Bulk Add](/guide/bulk-add) — Create multiple bins from photos using AI
- [Photos](/guide/photos) — Attach and manage bin photos
- [Configuration](/getting-started/configuration) — Server-wide AI environment variables

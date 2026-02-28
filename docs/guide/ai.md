# AI Features

OpenBin's AI features are fully optional. They require connecting your own API key or having an admin configure a server-wide key. Without an AI key, all other features work normally.

## Supported Providers

| Provider | Notes |
|---|---|
| **OpenAI** | GPT-4o, GPT-4 Turbo, and other OpenAI models |
| **Anthropic** | Claude models (e.g. claude-sonnet-4-5) |
| **Google Gemini** | Gemini 2.0 Flash and other Gemini models |
| **OpenAI-compatible** | Any endpoint following the OpenAI API format (e.g. Ollama, LM Studio, OpenRouter) |

## Per-User Setup

1. Go to **Settings → AI**.
2. Select your provider.
3. Enter your API key.
4. Select or type the model name.
5. For OpenAI-compatible endpoints, enter the endpoint URL.
6. Click **Save**.

AI features activate immediately after saving.

## Server-Wide Setup (Admin)

Admins can configure a shared AI key via environment variables so all users get AI features without individual setup:

```ini
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o
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

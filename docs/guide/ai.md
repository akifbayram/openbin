---
prev:
  text: 'Photos'
  link: '/guide/photos'
next:
  text: 'Bulk Add'
  link: '/guide/bulk-add'
---

# AI Features

AI is optional. Connect your own API key or have an admin set a server-wide key. Everything else works without it.

## Supported Providers

| Provider | Recommended Model |
|---|---|
| **[OpenAI](https://platform.openai.com/)** | `gpt-5-mini` |
| **[Anthropic](https://console.anthropic.com/)** | `claude-sonnet-4-6` |
| **[Google Gemini](https://aistudio.google.com/)** | `gemini-3-flash-preview` |
| **OpenAI-compatible** | — |

### Getting an API key

Create an API key from your provider's developer platform:

- **OpenAI** — [platform.openai.com](https://platform.openai.com/) → API Keys. [Pricing →](https://platform.openai.com/docs/pricing)
- **Anthropic** — [console.anthropic.com](https://console.anthropic.com/) → API Keys. [Pricing →](https://docs.anthropic.com/en/docs/about-claude/pricing)
- **Google Gemini** — [aistudio.google.com](https://aistudio.google.com/) → Get API key. Free tier available. [Pricing →](https://ai.google.dev/gemini-api/docs/pricing)

## Per-User Setup

Configure your provider, API key, and model in **Settings → AI**. AI features activate immediately after saving.

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

![AI photo analysis](../assets/ai-photos.png)

After uploading a photo to a bin, tap **Analyze with AI** to get suggestions for bin name, items (with quantities), tags, and notes. Each field can be accepted or dismissed independently.

If the first pass missed items or suggested incorrect names, you can re-analyze to get improved results. Tap the sparkle icon on the photo preview and click **Reanalyze** (or type a specific correction). The reanalysis sends both the photos and the previous suggestions back to the AI, so it can refine its output based on what it already identified. Changed fields are highlighted so you can see exactly what was updated.

## Natural Language Commands

The AI command bar (accessible from the bin list) accepts natural language instructions:

```
Add screwdriver to the tools bin
Move batteries to the garage area
Create a bin called Holiday Decorations with items: lights, ornaments, wrapping paper
Remove the extension cord from the electrical bin
```

OpenBin shows a preview of the action and asks for confirmation before making changes.

## Inventory Search

Ask natural language questions to search across all bins:

```
Where did I put the holiday lights?
Which bins have batteries?
What's in the attic?
Do I have any sandpaper?
```

Returns matching bins with an explanation of why each matched.

## AI Reorganization

The Reorganize page lets AI suggest how to restructure an entire location's bins, areas, and tags — then apply those changes in bulk.

1. Navigate to **Reorganize** from the sidebar.
2. Select the bins to include (defaults to all).
3. Click **Suggest Reorganization** — AI streams back proposed changes: renaming bins, moving them between areas, updating tags, and creating new areas.
4. Review the preview showing all proposed changes side-by-side with current state.
5. Click **Apply** to execute the changes or dismiss individual suggestions.

A custom reorganization prompt can be set in **Settings → AI → Advanced** to guide the AI's restructuring logic (e.g. "group by room" or "consolidate similar items").

## Custom Prompts

Advanced users can override the default AI prompts for each operation:

1. Go to **Settings → AI → Advanced**.
2. Enter a custom prompt for photo analysis, commands, search queries, text structuring, or reorganization.
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

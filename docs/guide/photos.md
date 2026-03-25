---
prev:
  text: 'Dashboard'
  link: '/guide/dashboard'
next:
  text: 'AI Features'
  link: '/guide/ai'
---

# Photos

Bins can have up to 5 photos. Photos are served through the API with authentication — not publicly accessible without a session.

## Attaching photos

Open a bin → expand **Photos** → **Upload**. Accepts JPEG, PNG, WebP. Max size configurable via `MAX_PHOTO_SIZE_MB` (default 5 MB).

## In-app camera

The built-in camera page lets you take consecutive photos without leaving the app. Opening it from a bin's detail page uploads each capture to that bin automatically.

## Using Photos with AI

Once a photo is attached to a bin, you can run AI analysis on it:

1. Open the bin detail page → **Photos** section.
2. Tap **Analyze with AI** on the photo you want to analyze.
3. Review the AI's suggestions (bin name, items list, tags, notes).
4. Apply whichever suggestions are useful.

See [AI Features](/guide/ai#photo-analysis) for details on setting up an AI provider.

## Photo as Card Background

Set a bin's **Card Style** to `photo` in the Appearance section to use an attached photo as the card background.

## Deleting Photos

Members can delete their own photos; admins can delete any photo. Deleting a cover photo reverts the card style to `default`.

::: warning
Photo deletion is permanent. There is no trash or recovery for individual photos.
:::

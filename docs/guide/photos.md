---
prev:
  text: 'Dashboard'
  link: '/guide/dashboard'
next:
  text: 'AI Features'
  link: '/guide/ai'
---

# Photos

Bins can have up to 5 photos attached. Photos are stored on the server and served through the API with authentication — they are never publicly accessible without a valid session.

## Attaching Photos

1. Open a bin's detail page.
2. Expand the **Photos** section.
3. Tap **Upload** and select one or more image files.
4. The photos appear in the gallery immediately after upload.

**Supported formats**: JPEG, PNG, WebP, and other common image formats.

**Maximum file size**: Configurable via the `MAX_PHOTO_SIZE_MB` environment variable (default: 5 MB per photo).

**Limit**: Up to 5 photos per bin.

## In-App Camera

You can take photos directly within OpenBin using the built-in camera capture page. This opens a full-screen camera view where you can take consecutive photos without switching to your device's camera app.

If you open the camera from a bin's detail page, each photo is uploaded to that bin automatically as you capture it. This is especially useful on mobile when cataloging many bins in a row.

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

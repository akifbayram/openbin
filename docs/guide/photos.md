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

## Photo Gallery

Uploaded photos appear in a collapsible gallery on the bin detail page. Tap any photo to view it full size. The gallery shows thumbnails for fast loading.

## Thumbnails

Thumbnails are generated automatically the first time a photo is viewed. They are:

- 600 px wide
- WebP format
- 70% quality
- Cached with immutable headers after generation

Subsequent loads of the same photo use the cached thumbnail, making the gallery fast even for large images.

## Using Photos with AI

Once a photo is attached to a bin, you can run AI analysis on it:

1. Open the bin detail page → **Photos** section.
2. Tap **Analyze with AI** on the photo you want to analyze.
3. Review the AI's suggestions (bin name, items list, tags, notes).
4. Apply whichever suggestions are useful.

See [AI Features](/guide/ai#photo-analysis) for details on setting up an AI provider.

## Photo as Card Background

To use a photo as the bin card's visual background:

1. Open the bin → **Edit**.
2. In the **Appearance** section, set **Card Style** to `photo`.
3. If the bin has multiple photos, select which one to use as the cover photo.
4. Save.

The photo appears as a full-bleed background on the bin card in the list and on the detail page.

## Deleting Photos

Tap the delete icon on any photo in the gallery to remove it.

- **Members** can delete photos they uploaded.
- **Admins** can delete any photo in the location.

Deleting a photo that is set as the `photo` card style cover will revert the card style to `glass`.

::: warning
Photo deletion is permanent. There is no trash or recovery for individual photos.
:::

## Related

- [Bins](/guide/bins) — Photos are attached to bins
- [AI Features](/guide/ai) — Analyze photos with AI to auto-populate bin details
- [API: Photos](/api/photos) — Photos REST API reference

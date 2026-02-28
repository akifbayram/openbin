---
prev:
  text: 'QR Scanning'
  link: '/guide/qr-scanning'
next:
  text: 'Search & Filter'
  link: '/guide/search-filter'
---

# Print Labels

OpenBin can generate QR label sheets for any selection of bins, ready to print on standard paper or export as a PDF.

## Navigating to Print

Access the print page from **Settings → Print** or from the bin list's action menu. The URL accepts a `?ids=` query parameter to pre-select specific bins — useful for bookmarks or linking directly from another page.

## Selecting Bins

The left panel shows your bins grouped by area. Use the checkboxes to select which bins to include on the sheet.

- **Select All** — selects every visible bin.
- **Select None** — clears the selection.
- **Select by Area** — expand an area to select or deselect all bins within it.

The preview panel on the right updates as you change the selection.

## Label Modes

| Mode | Description |
|---|---|
| `colored-card` | Full-color label with icon, bin name, a preview of items, and QR code. Reflects the bin's color and card style. |
| `plain-qr` | Minimal black-and-white label: QR code, bin name, and short code. Best for thermal printers or low-ink situations. |
| `icon-only` | Large icon with the bin name below it. No QR code. Useful for large, clearly-labeled storage. |
| `text-only` | Bin name and items list as plain text. No QR code. Useful for shelf labels or inventories. |

## Orientation

Switch between **Portrait** and **Landscape** for any page format.

## Custom Label Size

For fine-grained control, switch to custom label sizing and specify:

- Label width and height (mm)
- Padding inside each label (mm)
- Labels per row

## Font Scale

Adjust the text size relative to the label size. Smaller labels may need a lower font scale to avoid overflow; larger labels benefit from a higher scale.

## QR Style Customization

The **QR Style** card lets you change the visual appearance of QR codes:

| Option | Choices |
|---|---|
| Dot style | square, rounded, dots, classy, classy-rounded, extra-rounded |
| Corner style | square, extra-rounded, dot |
| QR foreground color | Any color (hex or picker) |
| QR background color | Any color (hex or picker), or transparent |

::: warning
Highly stylized QR codes or very low-contrast colors may reduce scan reliability. Test scan your labels before printing a large batch.
:::

## Saving Presets

Once you have a format you're happy with, save it as a named preset:

1. In the Format card, enter a preset name.
2. Click **Save Preset**.

Saved presets appear in the format selector for quick reuse across sessions. Presets are stored in your browser's local storage.

## PDF Export

Click **Download PDF** to generate a PDF file containing all selected labels at the configured size and format. The PDF can be sent to a print shop or opened in any PDF viewer.

## Browser Print

Click **Print** to open the browser's native print dialog. The print stylesheet hides the UI controls and renders only the label sheet.

::: tip
For best results with browser print, set margins to "None" in the print dialog and match the paper size to your selected format.
:::

## Related

- [Bins](/guide/bins) — Create and manage the bins you're printing labels for
- [QR Scanning](/guide/qr-scanning) — Scan the labels after printing
- [API: Print Settings](/api/print-settings) — Print Settings REST API reference

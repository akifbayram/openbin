---
prev:
  text: 'QR Scanning'
  link: '/guide/qr-scanning'
next:
  text: 'Search & Filter'
  link: '/guide/search-filter'
---

# Print Labels

![Print labels](../assets/print-labels.png)

## Print Modes

OpenBin supports three print modes: **Labels**, **Names**, and **Item List**.

<div class="image-row">
  <img alt="Labels mode" src="../assets/print-labels.png" />
  <img alt="Names mode" src="../assets/print-names.png" />
  <img alt="Item List mode" src="../assets/print-item-list.png" />
</div>

## Selecting Bins

The left panel shows bins grouped by area with checkboxes. Select individual bins, all bins, or all bins within an area. The preview updates live.

## Label Modes

| Mode | Description |
|---|---|
| `colored-card` | Full-color label with icon, bin name, a preview of items, and QR code. Reflects the bin's color and card style. |
| `plain-qr` | Minimal black-and-white label: QR code, bin name, and short code. Best for thermal printers or low-ink situations. |
| `icon-only` | Large icon with the bin name below it. No QR code. Useful for large, clearly-labeled storage. |
| `text-only` | Bin name and items list as plain text. No QR code. Useful for shelf labels or inventories. |

## Item List Mode

In addition to label sheets, you can print a text-based item list:

1. Switch the **Print Mode** toggle from **Labels** to **Item List**.
2. Select the bins to include.
3. Configure options: whether to show areas, tags, quantities, and how items are grouped.
4. Click **Print** or **Download PDF**.

Item list mode is useful for inventory checklists, packing lists, or auditing what's in each bin without QR codes.

## Name Cards Mode

Name cards print a grid of bin names without QR codes. They work well for shelf labels, drawer fronts, or anywhere you need a visible name tag rather than a scannable code.

1. Switch the **Print Mode** toggle to **Names**.
2. Select the bins to include.
3. Configure the options described below.
4. Click **Print** or **Download PDF**.

The **Name Options** card controls what each card displays:

| Option | Description |
|---|---|
| Bin Icon | Show or hide the bin's icon next to its name. |
| Color Background | Fill each card with the bin's assigned color. When off, cards use a neutral background. |
| Font Sizing | **Auto-fit** scales each bin's text independently to fill its card. **Uniform** uses the same font size across all cards. |
| Font Size | Visible when sizing is set to Uniform. Choose from S, Default, L, or XL. |

Name cards share the same label format and page layout settings as the Labels mode, so you can use any of the built-in or custom label sizes.

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

::: tip
For best results with browser print, set margins to "None" in the print dialog and match the paper size to your selected format.
:::

# Import & Export

OpenBin can export your location's data for backup or migration, and import data from a previous export or a supported external format.

## Export

Go to **Settings → Data** to access export options. Exports always include all bins in the currently active location.

### JSON Export

Downloads a structured JSON file (`openbin-backup-YYYY-MM-DD.json`) containing:

- All bins (name, items, tags, notes, icon, color, card style, short code, area, visibility, timestamps)
- Photos embedded as base64 strings inside each bin's data

JSON is the recommended format for full-fidelity backups. It preserves all metadata and photos.

### ZIP Export

Downloads a ZIP archive (`openbin-export-YYYY-MM-DD.zip`) containing:

- A JSON file with all bin data
- Original photo files in their native format (JPEG, PNG, etc.)

ZIP is preferable when you want to preserve original photo quality without base64 encoding overhead.

### CSV Export

Downloads a spreadsheet-compatible CSV file (`openbin-bins-YYYY-MM-DD.csv`) with one row per bin:

- Bin name, area, items (comma-separated within the cell), tags, notes

CSV does not include photos or card style settings. Use it when you need to open your inventory in a spreadsheet application.

## Import

Go to **Settings → Data → Import** and drag-and-drop a file or click to select one.

### Supported Import Formats

#### V2 JSON (current format)

Full-fidelity import. Restores:

- Bin name, items, tags, notes, icon, color, card style
- Photos (re-attached from embedded base64 data)
- Short codes are re-generated to avoid conflicts with existing bins

#### V1 JSON (legacy format)

The older export format used freeform `contents` strings instead of discrete items. When importing V1:

- The `contents` field is imported as the bin's **notes**.
- Tags and timestamps are preserved.

#### ZIP

Import a ZIP file exported from OpenBin. The importer reads the JSON inside the ZIP and re-attaches the bundled photos.

### Import Behavior

- Import **creates new bins** — it does not overwrite or merge with existing bins.
- Bins are imported into the **currently active location**.
- Short codes are re-generated for all imported bins.
- If a photo fails to import (e.g. unsupported format or size limit exceeded), the bin is still imported without that photo and the failure is reported in the results summary.

### Import Results

After import completes, OpenBin shows a summary:

- Bins imported successfully
- Bins skipped (if any)
- Photos imported
- Photos skipped

### File Size Limit

The maximum import file size is **100 MB**. For larger collections, split the export into multiple files.

::: tip
Always export a backup before importing. Imports cannot be bulk-undone — you would need to manually delete the imported bins or use bulk delete.
:::

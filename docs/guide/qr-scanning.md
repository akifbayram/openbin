---
prev:
  text: 'Bins'
  link: '/guide/bins'
next:
  text: 'Print Labels'
  link: '/guide/print-labels'
---

# QR Scanning

Each bin in OpenBin has a unique QR code that encodes its short code. Scanning a label takes you directly to the bin's detail page — no searching required.

## How QR Codes Work

When you print a label for a bin, the QR code encodes a URL that resolves to that specific bin. The URL includes the bin's 6-character short code. Scanning the code navigates to the bin's detail page showing its name, items, notes, tags, and photos.

- Path-based URLs: `/bin/CODE`

## Camera Scanner

1. Tap the **QR icon** in the navigation bar (bottom bar on mobile, sidebar on desktop).
2. Grant camera permission when prompted.
3. Point the camera at a bin label.
4. OpenBin detects the QR code and navigates to the bin automatically.

The scanner works in any orientation and handles standard QR code sizes. Good lighting improves scan speed.

## Manual Lookup

If you don't have a camera or prefer to type:

1. Open the scanner page.
2. Type or paste the 6-character short code into the input field.
3. Press Enter or tap **Look Up**.

The short code is printed below the QR code on every label, so you can always find a bin manually even if the QR code is damaged.

## What Happens on Scan

After a successful scan, OpenBin:

1. Navigates to the bin detail page.
2. Records the scan in your personal scan history.
3. Shows the bin's name, items, notes, tags, area, and photos.

From the detail page you can edit the bin, add items, view photos, or use AI to analyze its contents.

## Scan History

Your recent scans are tracked per user and displayed on the Dashboard under **Recently Scanned**. This makes it easy to return to bins you've recently looked at without scanning again.

To clear your scan history, go to **Settings → Clear Scan History**.

## PWA / Home Screen

OpenBin can be installed as a Progressive Web App (PWA) on Android and iOS:

- **Android**: Open OpenBin in Chrome → browser menu → **Add to Home Screen**.
- **iOS**: Open OpenBin in Safari → Share → **Add to Home Screen**.

Once installed, OpenBin behaves like a native app. The QR scanner uses the device camera and works without a browser chrome.

## Related

- [Bins](/guide/bins) — Create and manage bins
- [Print Labels](/guide/print-labels) — Generate QR label sheets for printing
- [Dashboard](/guide/dashboard) — View recent scans on the dashboard

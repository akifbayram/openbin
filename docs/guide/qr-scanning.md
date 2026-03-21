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

Each bin's QR label encodes a URL containing its 6-character short code (`/bin/CODE`). Scanning navigates directly to the bin's detail page.

## Camera Scanner

Tap the **QR icon** in the navigation bar to open the scanner. Point your camera at a label and OpenBin navigates to the bin automatically.

## Manual Lookup

Type or paste a bin's 6-character short code on the scanner page to look it up without a camera. The short code is printed below the QR code on every label.

## What Happens on Scan

Scanning navigates to the bin detail page and records the scan in your history. If the bin belongs to a location you haven't joined, you'll be prompted to join. If the bin has been deleted, you'll see an option to check the trash.

## Scan History

Your recent scans are tracked per user and displayed on the Dashboard under **Recently Scanned**. This makes it easy to return to bins you've recently looked at without scanning again.

To clear your scan history, go to **Settings → Clear Scan History**.

## PWA / Home Screen

OpenBin can be installed as a Progressive Web App (PWA) on Android and iOS:

- **Android**: Open OpenBin in Chrome → browser menu → **Add to Home Screen**.
- **iOS**: Open OpenBin in Safari → Share → **Add to Home Screen**.

Once installed, OpenBin behaves like a native app. The QR scanner uses the device camera and works without a browser chrome.
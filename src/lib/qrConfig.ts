export type QrPayloadMode = 'app' | 'url';

interface QrConfig {
  qrPayloadMode: QrPayloadMode;
  baseUrl?: string;
}

let cached: QrConfig = { qrPayloadMode: 'app' };

export function getQrConfig(): QrConfig {
  return cached;
}

export async function initQrConfig(): Promise<void> {
  try {
    const res = await fetch('/api/auth/status');
    if (!res.ok) return;
    const data = await res.json();
    if (data.qrPayloadMode === 'url' && data.baseUrl) {
      cached = { qrPayloadMode: 'url', baseUrl: data.baseUrl };
    } else {
      cached = { qrPayloadMode: 'app' };
    }
  } catch {
    // Keep default (app mode) on network failure
  }
}

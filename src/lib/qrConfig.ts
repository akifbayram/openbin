export type QrPayloadMode = 'app' | 'url';

interface QrConfig {
  qrPayloadMode: QrPayloadMode;
  baseUrl?: string;
}

let cached: QrConfig = { qrPayloadMode: 'app' };
let selfHostedCached = true; // default true (safe: hides cloud-only UI until confirmed)
let attachmentsEnabledCached = false; // default false — feature is hidden until server confirms
let initPromise: Promise<void> | null = null;

export function getQrConfig(): QrConfig {
  return cached;
}

/** Whether the instance is self-hosted (available after initQrConfig resolves). */
export function isSelfHostedInstance(): boolean {
  return selfHostedCached;
}

/** Whether the non-image attachments feature is enabled on this server. */
export function isAttachmentsEnabled(): boolean {
  return attachmentsEnabledCached;
}

/** Wait for the initial config fetch to complete. */
export function waitForConfig(): Promise<void> {
  return initPromise ?? Promise.resolve();
}

export async function initQrConfig(): Promise<void> {
  const p = _doInit();
  initPromise = p;
  return p;
}

async function _doInit(): Promise<void> {
  try {
    const res = await fetch('/api/auth/status');
    if (!res.ok) return;
    const data = await res.json();
    if (data.qrPayloadMode === 'url' && data.baseUrl) {
      cached = { qrPayloadMode: 'url', baseUrl: data.baseUrl };
    } else {
      cached = { qrPayloadMode: 'app' };
    }
    if (typeof data.selfHosted === 'boolean') {
      selfHostedCached = data.selfHosted;
    }
    if (typeof data.attachmentsEnabled === 'boolean') {
      attachmentsEnabledCached = data.attachmentsEnabled;
    }
  } catch {
    // Keep defaults on network failure
  }
}

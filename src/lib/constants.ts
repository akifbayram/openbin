import { getQrConfig } from './qrConfig';

export function getBinUrl(binId: string): string {
  return `${window.location.origin}/bin/${binId}`;
}

export function getBinQrPayload(binId: string): string {
  const config = getQrConfig();
  if (config.qrPayloadMode === 'url' && config.baseUrl) {
    return `${config.baseUrl}/bin/${binId}`;
  }
  return `openbin://bin/${binId}`;
}

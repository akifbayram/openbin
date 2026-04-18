import { getQrConfig } from './qrConfig';

export function getBinQrPayload(binId: string): string {
  const config = getQrConfig();
  if (config.qrPayloadMode === 'url' && config.baseUrl) {
    return `${config.baseUrl}/bin/${binId}`;
  }
  return `openbin://bin/${binId}`;
}

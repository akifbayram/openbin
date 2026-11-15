import { type ApiClient } from "./api-client.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBinUuid(id: string): boolean {
  return UUID_RE.test(id);
}

/**
 * Resolve a bin reference to its UUID. The API's /api/bins/:id routes only
 * accept UUIDs, but tools advertise short codes, so look short codes up first.
 * The lookup endpoint skips trashed bins; trash tools must be given UUIDs.
 */
export async function resolveBinId(api: ApiClient, id: string): Promise<string> {
  if (isBinUuid(id)) return id;
  const bin = await api.get<{ id: string }>(`/api/bins/lookup/${encodeURIComponent(id)}`);
  return bin.id;
}

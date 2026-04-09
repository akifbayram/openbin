import { type ApiClient } from "./api-client.js";

export interface BinItem {
  id: string;
  name: string;
}

export interface BinDetail {
  id: string;
  items: BinItem[];
}

/**
 * Resolve an item by ID or name within a bin.
 * When item_id is provided, skips the bin fetch (server validates existence).
 * Returns the matched name when resolved by name; falls back to the raw ID otherwise.
 */
export async function resolveItemId(
  api: ApiClient,
  bin_id: string,
  item_id: string | undefined,
  item_name: string | undefined,
): Promise<{ id: string; name: string } | { error: string }> {
  if (!item_id && !item_name) {
    return { error: "Provide either 'item_id' or 'item_name'." };
  }

  if (item_id) {
    return { id: item_id, name: item_id };
  }

  const bin = await api.get<BinDetail>(`/api/bins/${encodeURIComponent(bin_id)}`);
  const matches = bin.items.filter(
    (i) => i.name.toLowerCase() === item_name!.toLowerCase(),
  );

  if (matches.length === 0) {
    return { error: `No item named "${item_name}" found in this bin.` };
  }
  if (matches.length > 1) {
    const list = matches.map((m) => `- ${m.name} [${m.id}]`).join("\n");
    return {
      error: `Multiple items named "${item_name}" found. Specify item_id to disambiguate:\n${list}`,
    };
  }
  return { id: matches[0].id, name: matches[0].name };
}

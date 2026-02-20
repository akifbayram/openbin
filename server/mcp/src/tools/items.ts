import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type ApiClient, withErrorHandling } from "../api-client.js";

interface Item {
  id: string;
  name: string;
  bin_id: string;
  bin_name: string;
  bin_icon: string;
  bin_color: string;
}

interface ItemListResponse {
  results: Item[];
  count: number;
}

interface BinItem {
  id: string;
  name: string;
}

interface BinDetail {
  id: string;
  items: BinItem[];
}

interface AddItemsResponse {
  items: Array<{ id: string; name: string }>;
}

async function resolveItemId(
  api: ApiClient,
  bin_id: string,
  item_id: string | undefined,
  item_name: string | undefined,
): Promise<{ id: string } | { error: string }> {
  if (item_id) return { id: item_id };

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
  return { id: matches[0].id };
}

export function registerItemTools(server: McpServer, api: ApiClient) {
  server.tool(
    "search_items",
    "Search items across all bins in a location",
    {
      location_id: z.string().describe("Location UUID (required)"),
      q: z.string().optional().describe("Search text"),
      sort: z.enum(["alpha", "bin"]).optional().describe("Sort by item name or bin name"),
      limit: z.number().min(1).max(100).optional().describe("Max results (1-100, default 40)"),
      offset: z.number().min(0).optional().describe("Offset for pagination"),
    },
    withErrorHandling(async ({ location_id, q, sort, limit, offset }) => {
      const params = new URLSearchParams({ location_id });
      if (q) params.set("q", q);
      if (sort) params.set("sort", sort);
      if (limit !== undefined) params.set("limit", String(limit));
      if (offset !== undefined) params.set("offset", String(offset));

      const data = await api.get<ItemListResponse>(`/api/items?${params}`);

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "No items found." }] };
      }

      const lines = data.results.map(
        (item) => `- **${item.name}** [${item.id}] in bin "${item.bin_name}" (bin_id: ${item.bin_id})`,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${data.count} item(s)${data.results.length < data.count ? ` (showing ${data.results.length})` : ""}:\n\n${lines.join("\n")}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "add_items",
    "Add items to a bin",
    {
      bin_id: z.string().describe("Bin UUID"),
      items: z.array(z.string()).min(1).describe("Item names to add"),
    },
    withErrorHandling(async ({ bin_id, items }) => {
      const data = await api.post<AddItemsResponse>(
        `/api/bins/${encodeURIComponent(bin_id)}/items`,
        { items },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Added ${data.items.length} item(s): ${data.items.map((i) => i.name).join(", ")}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "remove_item",
    "Remove a single item from a bin. Provide item_id or item_name (not both).",
    {
      bin_id: z.string().describe("Bin UUID"),
      item_id: z.string().optional().describe("Item UUID"),
      item_name: z.string().optional().describe("Item name (case-insensitive match)"),
    },
    withErrorHandling(async ({ bin_id, item_id, item_name }) => {
      if (!item_id && !item_name) {
        return {
          content: [{ type: "text" as const, text: "Provide either 'item_id' or 'item_name'." }],
          isError: true,
        };
      }

      const resolved = await resolveItemId(api, bin_id, item_id, item_name);
      if ("error" in resolved) {
        return { content: [{ type: "text" as const, text: resolved.error }], isError: true };
      }

      await api.del(
        `/api/bins/${encodeURIComponent(bin_id)}/items/${encodeURIComponent(resolved.id)}`,
      );

      return {
        content: [{ type: "text" as const, text: "Item removed successfully." }],
      };
    }),
  );

  server.tool(
    "rename_item",
    "Rename an item within a bin. Provide item_id or item_name (not both).",
    {
      bin_id: z.string().describe("Bin UUID"),
      item_id: z.string().optional().describe("Item UUID"),
      item_name: z.string().optional().describe("Current item name (case-insensitive match)"),
      name: z.string().describe("New item name"),
    },
    withErrorHandling(async ({ bin_id, item_id, item_name, name }) => {
      if (!item_id && !item_name) {
        return {
          content: [{ type: "text" as const, text: "Provide either 'item_id' or 'item_name'." }],
          isError: true,
        };
      }

      const resolved = await resolveItemId(api, bin_id, item_id, item_name);
      if ("error" in resolved) {
        return { content: [{ type: "text" as const, text: resolved.error }], isError: true };
      }

      const item = await api.put<{ id: string; name: string }>(
        `/api/bins/${encodeURIComponent(bin_id)}/items/${encodeURIComponent(resolved.id)}`,
        { name },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Item renamed to "${item.name}".`,
          },
        ],
      };
    }),
  );

  server.tool(
    "reorder_items",
    "Reorder items within a bin. Provide item_ids or item_names (not both).",
    {
      bin_id: z.string().describe("Bin UUID"),
      item_ids: z.array(z.string()).optional().describe("Item UUIDs in the desired order"),
      item_names: z.array(z.string()).optional().describe("Item names in the desired order (resolved to IDs via bin lookup)"),
    },
    withErrorHandling(async ({ bin_id, item_ids, item_names }) => {
      if (!item_ids && !item_names) {
        return {
          content: [{ type: "text" as const, text: "Provide either 'item_ids' or 'item_names'." }],
          isError: true,
        };
      }

      let resolvedIds = item_ids;
      if (!resolvedIds && item_names) {
        const bin = await api.get<BinDetail>(`/api/bins/${encodeURIComponent(bin_id)}`);
        const ids: string[] = [];
        for (const name of item_names) {
          const matches = bin.items.filter(
            (i) => i.name.toLowerCase() === name.toLowerCase(),
          );
          if (matches.length === 0) {
            return {
              content: [{ type: "text" as const, text: `No item named "${name}" found in this bin.` }],
              isError: true,
            };
          }
          if (matches.length > 1) {
            const list = matches.map((m) => `- ${m.name} [${m.id}]`).join("\n");
            return {
              content: [{ type: "text" as const, text: `Multiple items named "${name}" found. Use item_ids instead:\n${list}` }],
              isError: true,
            };
          }
          ids.push(matches[0].id);
        }
        resolvedIds = ids;
      }

      await api.put(
        `/api/bins/${encodeURIComponent(bin_id)}/items/reorder`,
        { item_ids: resolvedIds },
      );

      return {
        content: [{ type: "text" as const, text: `Items reordered (${resolvedIds!.length} items).` }],
      };
    }),
  );
}

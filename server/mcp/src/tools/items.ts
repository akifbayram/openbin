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

interface AddItemsResponse {
  items: Array<{ id: string; name: string }>;
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
    },
    withErrorHandling(async ({ location_id, q, sort, limit }) => {
      const params = new URLSearchParams({ location_id });
      if (q) params.set("q", q);
      if (sort) params.set("sort", sort);
      if (limit) params.set("limit", String(limit));

      const data = await api.get<ItemListResponse>(`/api/items?${params}`);

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "No items found." }] };
      }

      const lines = data.results.map(
        (item) => `- **${item.name}** in bin "${item.bin_name}" (bin_id: ${item.bin_id})`,
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
    "Remove a single item from a bin",
    {
      bin_id: z.string().describe("Bin UUID"),
      item_id: z.string().describe("Item UUID"),
    },
    withErrorHandling(async ({ bin_id, item_id }) => {
      await api.del(
        `/api/bins/${encodeURIComponent(bin_id)}/items/${encodeURIComponent(item_id)}`,
      );

      return {
        content: [{ type: "text" as const, text: "Item removed successfully." }],
      };
    }),
  );

  server.tool(
    "rename_item",
    "Rename an item within a bin",
    {
      bin_id: z.string().describe("Bin UUID"),
      item_id: z.string().describe("Item UUID"),
      name: z.string().describe("New item name"),
    },
    withErrorHandling(async ({ bin_id, item_id, name }) => {
      const item = await api.put<{ id: string; name: string }>(
        `/api/bins/${encodeURIComponent(bin_id)}/items/${encodeURIComponent(item_id)}`,
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
    "Reorder items within a bin",
    {
      bin_id: z.string().describe("Bin UUID"),
      item_ids: z.array(z.string()).min(1).describe("Item UUIDs in the desired order"),
    },
    withErrorHandling(async ({ bin_id, item_ids }) => {
      await api.put(
        `/api/bins/${encodeURIComponent(bin_id)}/items/reorder`,
        { item_ids },
      );

      return {
        content: [{ type: "text" as const, text: `Items reordered (${item_ids.length} items).` }],
      };
    }),
  );
}

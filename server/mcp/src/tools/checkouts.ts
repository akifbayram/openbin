import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type ApiClient, withErrorHandling } from "../api-client.js";
import { resolveItemId } from "../resolve-item.js";

interface CheckoutListResponse {
  results: Array<{
    id: string;
    item_id: string;
    item_name: string;
    checked_out_by_name: string;
    checked_out_at: string;
  }>;
  count: number;
}

interface LocationCheckoutListResponse {
  results: Array<{
    id: string;
    item_name: string;
    origin_bin_name: string;
    checked_out_by_name: string;
    checked_out_at: string;
  }>;
  count: number;
}

export function registerCheckoutTools(server: McpServer, api: ApiClient) {
  server.tool(
    "checkout_item",
    "Check out an item from a bin. Provide item_id or item_name (not both).",
    {
      bin_id: z.string().describe("Bin ID (6-character short code)"),
      item_id: z.string().optional().describe("Item UUID"),
      item_name: z.string().optional().describe("Item name (case-insensitive match)"),
    },
    withErrorHandling(async ({ bin_id, item_id, item_name }) => {
      const resolved = await resolveItemId(api, bin_id, item_id, item_name);
      if ("error" in resolved) {
        return { content: [{ type: "text" as const, text: resolved.error }], isError: true };
      }

      await api.post(
        `/api/bins/${encodeURIComponent(bin_id)}/items/${encodeURIComponent(resolved.id)}/checkout`,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Checked out "${resolved.name}" from bin ${bin_id}.`,
          },
        ],
      };
    }),
  );

  server.tool(
    "return_item",
    "Return a checked-out item. Optionally return it to a different bin. Provide item_id or item_name (not both).",
    {
      bin_id: z.string().describe("Origin bin ID (6-character short code)"),
      item_id: z.string().optional().describe("Item UUID"),
      item_name: z.string().optional().describe("Item name (case-insensitive match)"),
      target_bin_id: z.string().optional().describe("Return to a different bin (must be in same location)"),
    },
    withErrorHandling(async ({ bin_id, item_id, item_name, target_bin_id }) => {
      const resolved = await resolveItemId(api, bin_id, item_id, item_name);
      if ("error" in resolved) {
        return { content: [{ type: "text" as const, text: resolved.error }], isError: true };
      }

      const body = target_bin_id ? { targetBinId: target_bin_id } : undefined;
      await api.post(
        `/api/bins/${encodeURIComponent(bin_id)}/items/${encodeURIComponent(resolved.id)}/return`,
        body,
      );

      const dest = target_bin_id ? ` to bin ${target_bin_id}` : "";
      return {
        content: [
          {
            type: "text" as const,
            text: `Returned "${resolved.name}"${dest}.`,
          },
        ],
      };
    }),
  );

  server.tool(
    "list_bin_checkouts",
    "List active (unreturned) checkouts for a specific bin",
    {
      bin_id: z.string().describe("Bin ID (6-character short code)"),
    },
    withErrorHandling(async ({ bin_id }) => {
      const data = await api.get<CheckoutListResponse>(
        `/api/bins/${encodeURIComponent(bin_id)}/checkouts`,
      );

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "No active checkouts for this bin." }] };
      }

      const lines = data.results.map(
        (c) => `- **${c.item_name}** [${c.item_id}] — checked out by ${c.checked_out_by_name} at ${c.checked_out_at}`,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `${data.count} active checkout(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "list_location_checkouts",
    "List all active (unreturned) checkouts across a location",
    {
      location_id: z.string().describe("Location UUID"),
    },
    withErrorHandling(async ({ location_id }) => {
      const data = await api.get<LocationCheckoutListResponse>(
        `/api/locations/${encodeURIComponent(location_id)}/checkouts`,
      );

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "No active checkouts in this location." }] };
      }

      const lines = data.results.map(
        (c) => `- **${c.item_name}** from "${c.origin_bin_name}" — checked out by ${c.checked_out_by_name} at ${c.checked_out_at}`,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `${data.count} active checkout(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }),
  );
}

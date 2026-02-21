import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type ApiClient, withErrorHandling } from "../api-client.js";

interface BinItem {
  id: string;
  name: string;
}

interface Bin {
  id: string;
  location_id: string;
  name: string;
  area_id: string | null;
  area_name: string;
  items: BinItem[];
  notes: string;
  tags: string[];
  icon: string;
  color: string;
  short_code: string;
  created_by_name: string;
  visibility: string;
  created_at: string;
  updated_at: string;
  is_pinned?: boolean;
}

interface ListResponse {
  results: Bin[];
  count: number;
}

function formatBin(bin: Bin): string {
  const parts = [`**${bin.name}** (${bin.short_code})`, `ID: ${bin.id}`];

  if (bin.area_name) parts.push(`Area: ${bin.area_name}`);
  if (bin.items.length > 0)
    parts.push(`Items (${bin.items.length}): ${bin.items.map((i) => `${i.name} [${i.id}]`).join(", ")}`);
  if (bin.tags.length > 0) parts.push(`Tags: ${bin.tags.join(", ")}`);
  if (bin.notes) parts.push(`Notes: ${bin.notes}`);
  if (bin.icon) parts.push(`Icon: ${bin.icon}`);
  if (bin.color) parts.push(`Color: ${bin.color}`);
  parts.push(`Created by: ${bin.created_by_name} | Updated: ${bin.updated_at}`);

  return parts.join("\n");
}

export function registerBinTools(server: McpServer, api: ApiClient) {
  server.tool(
    "search_bins",
    "Search bins in a location with optional filters",
    {
      location_id: z.string().describe("Location UUID (required)"),
      q: z.string().optional().describe("Search text (searches name, notes, items, tags)"),
      tag: z.string().optional().describe("Filter by a single tag"),
      tags: z.string().optional().describe("Filter by multiple tags (comma-separated)"),
      area_id: z
        .string()
        .optional()
        .describe("Filter by area UUID (use '__unassigned__' for bins with no area)"),
      sort: z
        .enum(["name", "created_at", "updated_at", "area"])
        .optional()
        .describe("Sort field"),
      sort_dir: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
      limit: z.number().min(1).max(100).optional().describe("Max results (1-100)"),
      offset: z.number().min(0).optional().describe("Offset for pagination (requires limit)"),
      tag_mode: z
        .enum(["any", "all"])
        .optional()
        .describe("How to match multiple tags: 'any' (default, OR) or 'all' (AND)"),
    },
    withErrorHandling(async ({ location_id, q, tag, tags, area_id, sort, sort_dir, limit, offset, tag_mode }) => {
      const params = new URLSearchParams({ location_id });
      if (q) params.set("q", q);
      if (tags) params.set("tags", tags);
      else if (tag) params.set("tag", tag);
      if (tag_mode === "all") params.set("tag_mode", "all");
      if (area_id) params.set("area_id", area_id);
      if (sort) params.set("sort", sort);
      if (sort_dir) params.set("sort_dir", sort_dir);
      if (limit !== undefined) params.set("limit", String(limit));
      if (offset !== undefined) params.set("offset", String(offset));

      const data = await api.get<ListResponse>(`/api/bins?${params}`);

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "No bins found matching your search." }] };
      }

      const lines = data.results.map((bin) => formatBin(bin));

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${data.count} bin(s)${data.results.length < data.count ? ` (showing ${data.results.length})` : ""}:\n\n${lines.join("\n\n---\n\n")}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "get_bin",
    "Get a single bin by ID or short code",
    {
      id: z.string().optional().describe("Bin UUID"),
      short_code: z.string().optional().describe("6-character short code (e.g. 'A1B2C3')"),
    },
    withErrorHandling(async ({ id, short_code }) => {
      if (!id && !short_code) {
        return {
          content: [{ type: "text" as const, text: "Provide either 'id' or 'short_code'." }],
          isError: true,
        };
      }

      const path = id
        ? `/api/bins/${encodeURIComponent(id)}`
        : `/api/bins/lookup/${encodeURIComponent(short_code!)}`;

      const bin = await api.get<Bin>(path);

      return { content: [{ type: "text" as const, text: formatBin(bin) }] };
    }),
  );

  server.tool(
    "create_bin",
    "Create a new bin in a location",
    {
      location_id: z.string().describe("Location UUID"),
      name: z.string().describe("Bin name"),
      items: z.array(z.string()).optional().describe("List of item names"),
      tags: z.array(z.string()).optional().describe("List of tags"),
      notes: z.string().optional().describe("Notes"),
      area_id: z.string().optional().describe("Area UUID to assign the bin to"),
      icon: z.string().optional().describe("Icon identifier"),
      color: z.string().optional().describe("Color value"),
    },
    withErrorHandling(async ({ location_id, name, items, tags, notes, area_id, icon, color }) => {
      const body: Record<string, unknown> = { locationId: location_id, name };
      if (items) body.items = items;
      if (tags) body.tags = tags;
      if (notes) body.notes = notes;
      if (area_id) body.areaId = area_id;
      if (icon) body.icon = icon;
      if (color) body.color = color;

      const bin = await api.post<Bin>("/api/bins", body);

      return {
        content: [
          {
            type: "text" as const,
            text: `Bin created successfully!\n\n${formatBin(bin)}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "update_bin",
    "Update an existing bin",
    {
      id: z.string().describe("Bin UUID"),
      name: z.string().optional().describe("New bin name"),
      items: z
        .array(z.string())
        .optional()
        .describe("Replace all items with this list"),
      tags: z.array(z.string()).optional().describe("Replace all tags with this list"),
      notes: z.string().optional().describe("New notes"),
      area_id: z
        .string()
        .nullable()
        .optional()
        .describe("Area UUID (null to unassign)"),
      icon: z.string().optional().describe("Icon identifier"),
      color: z.string().optional().describe("Color value"),
    },
    withErrorHandling(async ({ id, name, items, tags, notes, area_id, icon, color }) => {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (items !== undefined) body.items = items;
      if (tags !== undefined) body.tags = tags;
      if (notes !== undefined) body.notes = notes;
      if (area_id !== undefined) body.areaId = area_id;
      if (icon !== undefined) body.icon = icon;
      if (color !== undefined) body.color = color;

      const bin = await api.put<Bin>(`/api/bins/${encodeURIComponent(id)}`, body);

      return {
        content: [
          {
            type: "text" as const,
            text: `Bin updated successfully!\n\n${formatBin(bin)}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "delete_bin",
    "Soft-delete a bin (moves to trash, can be restored)",
    { id: z.string().describe("Bin UUID") },
    withErrorHandling(async ({ id }) => {
      const bin = await api.del<Bin>(`/api/bins/${encodeURIComponent(id)}`);

      return {
        content: [
          {
            type: "text" as const,
            text: `Bin "${bin.name}" (${bin.short_code}) has been moved to trash.`,
          },
        ],
      };
    }),
  );

  // --- Trash ---

  server.tool(
    "list_trash",
    "List soft-deleted bins in a location's trash",
    {
      location_id: z.string().describe("Location UUID"),
    },
    withErrorHandling(async ({ location_id }) => {
      const params = new URLSearchParams({ location_id });
      const data = await api.get<ListResponse>(`/api/bins/trash?${params}`);

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "Trash is empty." }] };
      }

      const lines = data.results.map((bin) => formatBin(bin));

      return {
        content: [
          {
            type: "text" as const,
            text: `${data.count} bin(s) in trash:\n\n${lines.join("\n\n---\n\n")}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "restore_bin",
    "Restore a soft-deleted bin from trash",
    { id: z.string().describe("Bin UUID") },
    withErrorHandling(async ({ id }) => {
      const bin = await api.post<Bin>(`/api/bins/${encodeURIComponent(id)}/restore`);

      return {
        content: [
          {
            type: "text" as const,
            text: `Bin restored!\n\n${formatBin(bin)}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "permanent_delete_bin",
    "Permanently delete a bin from trash (cannot be undone)",
    { id: z.string().describe("Bin UUID (must already be in trash)") },
    withErrorHandling(async ({ id }) => {
      await api.del(`/api/bins/${encodeURIComponent(id)}/permanent`);

      return {
        content: [{ type: "text" as const, text: "Bin permanently deleted." }],
      };
    }),
  );

  // --- Pins ---

  server.tool(
    "list_pinned_bins",
    "List pinned bins for the current user in a location",
    {
      location_id: z.string().describe("Location UUID"),
    },
    withErrorHandling(async ({ location_id }) => {
      const params = new URLSearchParams({ location_id });
      const data = await api.get<ListResponse>(`/api/bins/pinned?${params}`);

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "No pinned bins." }] };
      }

      const lines = data.results.map((bin) => formatBin(bin));

      return {
        content: [
          {
            type: "text" as const,
            text: `${data.count} pinned bin(s):\n\n${lines.join("\n\n---\n\n")}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "pin_bin",
    "Pin a bin for quick access",
    { id: z.string().describe("Bin UUID") },
    withErrorHandling(async ({ id }) => {
      await api.post(`/api/bins/${encodeURIComponent(id)}/pin`);

      return {
        content: [{ type: "text" as const, text: "Bin pinned." }],
      };
    }),
  );

  server.tool(
    "unpin_bin",
    "Unpin a bin",
    { id: z.string().describe("Bin UUID") },
    withErrorHandling(async ({ id }) => {
      await api.del(`/api/bins/${encodeURIComponent(id)}/pin`);

      return {
        content: [{ type: "text" as const, text: "Bin unpinned." }],
      };
    }),
  );

  server.tool(
    "reorder_pinned_bins",
    "Reorder pinned bins",
    {
      bin_ids: z.array(z.string()).min(1).describe("Bin UUIDs in the desired order"),
    },
    withErrorHandling(async ({ bin_ids }) => {
      await api.put("/api/bins/pinned/reorder", { bin_ids });

      return {
        content: [{ type: "text" as const, text: `Pinned bins reordered (${bin_ids.length} bins).` }],
      };
    }),
  );

  // --- Tags ---

  server.tool(
    "add_tags",
    "Add tags to a bin (merges with existing tags, does not replace them)",
    {
      id: z.string().describe("Bin UUID"),
      tags: z.array(z.string()).min(1).describe("Tag names to add"),
    },
    withErrorHandling(async ({ id, tags }) => {
      const result = await api.put<{ id: string; tags: string[] }>(
        `/api/bins/${encodeURIComponent(id)}/add-tags`,
        { tags },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Tags updated. Bin now has ${result.tags.length} tag(s): ${result.tags.join(", ")}`,
          },
        ],
      };
    }),
  );

  // --- Move ---

  server.tool(
    "move_bin",
    "Move a bin to a different location (admin only). Area is unassigned after move.",
    {
      id: z.string().describe("Bin UUID"),
      location_id: z.string().describe("Target location UUID"),
    },
    withErrorHandling(async ({ id, location_id }) => {
      const bin = await api.post<Bin>(
        `/api/bins/${encodeURIComponent(id)}/move`,
        { locationId: location_id },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Bin moved!\n\n${formatBin(bin)}`,
          },
        ],
      };
    }),
  );
}

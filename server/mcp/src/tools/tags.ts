import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type ApiClient, withErrorHandling } from "../api-client.js";

interface Tag {
  tag: string;
  count: number;
}

interface ListResponse {
  results: Tag[];
  count: number;
}

interface TagColor {
  id: string;
  location_id: string;
  tag: string;
  color: string;
  created_at: string;
  updated_at: string;
}

interface TagColorListResponse {
  results: TagColor[];
  count: number;
}

export function registerTagTools(server: McpServer, api: ApiClient) {
  server.tool(
    "list_tags",
    "List all tags used in a location with usage counts",
    {
      location_id: z.string().describe("Location UUID (required)"),
      q: z.string().optional().describe("Search text to filter tags"),
      limit: z.number().min(1).max(100).optional().describe("Max results (1-100, default 40)"),
    },
    withErrorHandling(async ({ location_id, q, limit }) => {
      const params = new URLSearchParams({ location_id });
      if (q) params.set("q", q);
      if (limit) params.set("limit", String(limit));

      const data = await api.get<ListResponse>(`/api/tags?${params}`);

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "No tags found." }] };
      }

      const lines = data.results.map((t) => `- **${t.tag}** (${t.count} bin${t.count !== 1 ? "s" : ""})`);

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${data.count} tag(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }),
  );

  // --- Tag Colors ---

  server.tool(
    "list_tag_colors",
    "List all tag color assignments for a location",
    {
      location_id: z.string().describe("Location UUID"),
    },
    withErrorHandling(async ({ location_id }) => {
      const params = new URLSearchParams({ location_id });
      const data = await api.get<TagColorListResponse>(`/api/tag-colors?${params}`);

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "No tag colors configured." }] };
      }

      const lines = data.results.map((tc) => `- **${tc.tag}**: ${tc.color}`);

      return {
        content: [
          {
            type: "text" as const,
            text: `${data.count} tag color(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "set_tag_color",
    "Set or update the color for a tag in a location",
    {
      location_id: z.string().describe("Location UUID"),
      tag: z.string().describe("Tag name"),
      color: z.string().describe("Color value (e.g. '#ff0000', 'red')"),
    },
    withErrorHandling(async ({ location_id, tag, color }) => {
      await api.put("/api/tag-colors", { locationId: location_id, tag, color });

      return {
        content: [
          {
            type: "text" as const,
            text: `Tag color set: "${tag}" → ${color}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "delete_tag_color",
    "Remove the color assignment for a tag",
    {
      location_id: z.string().describe("Location UUID"),
      tag: z.string().describe("Tag name"),
    },
    withErrorHandling(async ({ location_id, tag }) => {
      const params = new URLSearchParams({ location_id });
      await api.del(`/api/tag-colors/${encodeURIComponent(tag)}?${params}`);

      return {
        content: [{ type: "text" as const, text: `Tag color removed for "${tag}".` }],
      };
    }),
  );
}

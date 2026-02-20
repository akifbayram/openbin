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
}

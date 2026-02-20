import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type ApiClient, withErrorHandling } from "../api-client.js";

interface Area {
  id: string;
  name: string;
  location_id: string;
  created_at: string;
}

interface ListResponse {
  results: Area[];
  count: number;
}

export function registerAreaTools(server: McpServer, api: ApiClient) {
  server.tool(
    "list_areas",
    "List all areas within a location",
    { location_id: z.string().describe("Location UUID") },
    withErrorHandling(async ({ location_id }) => {
      const data = await api.get<ListResponse>(
        `/api/locations/${encodeURIComponent(location_id)}/areas`,
      );

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "No areas found in this location." }] };
      }

      const lines = data.results.map((area) => `- **${area.name}** (id: ${area.id})`);

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${data.count} area(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }),
  );
}

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

  server.tool(
    "create_area",
    "Create a new area within a location (admin only)",
    {
      location_id: z.string().describe("Location UUID"),
      name: z.string().describe("Area name"),
    },
    withErrorHandling(async ({ location_id, name }) => {
      const area = await api.post<Area>(
        `/api/locations/${encodeURIComponent(location_id)}/areas`,
        { name },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Area created successfully!\n\n- **${area.name}** (id: ${area.id})`,
          },
        ],
      };
    }),
  );

  server.tool(
    "rename_area",
    "Rename an existing area (admin only)",
    {
      location_id: z.string().describe("Location UUID"),
      area_id: z.string().describe("Area UUID"),
      name: z.string().describe("New area name"),
    },
    withErrorHandling(async ({ location_id, area_id, name }) => {
      const area = await api.put<Area>(
        `/api/locations/${encodeURIComponent(location_id)}/areas/${encodeURIComponent(area_id)}`,
        { name },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Area renamed successfully!\n\n- **${area.name}** (id: ${area.id})`,
          },
        ],
      };
    }),
  );

  server.tool(
    "delete_area",
    "Delete an area (admin only). Bins in the area become unassigned.",
    {
      location_id: z.string().describe("Location UUID"),
      area_id: z.string().describe("Area UUID"),
    },
    withErrorHandling(async ({ location_id, area_id }) => {
      await api.del(
        `/api/locations/${encodeURIComponent(location_id)}/areas/${encodeURIComponent(area_id)}`,
      );

      return {
        content: [{ type: "text" as const, text: "Area deleted. Any bins in it are now unassigned." }],
      };
    }),
  );
}

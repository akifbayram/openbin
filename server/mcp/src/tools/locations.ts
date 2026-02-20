import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type ApiClient, withErrorHandling } from "../api-client.js";

interface Location {
  id: string;
  name: string;
  role: string;
  member_count: number;
  area_count: number;
  invite_code: string;
  term_bin: string;
  term_location: string;
  term_area: string;
  created_at: string;
}

interface ListResponse {
  results: Location[];
  count: number;
}

export function registerLocationTools(server: McpServer, api: ApiClient) {
  server.tool(
    "list_locations",
    "List all locations the authenticated user belongs to",
    {},
    withErrorHandling(async () => {
      const data = await api.get<ListResponse>("/api/locations");

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "No locations found." }] };
      }

      const lines = data.results.map(
        (loc) =>
          `- **${loc.name}** (id: ${loc.id})\n  Role: ${loc.role} | Members: ${loc.member_count} | Areas: ${loc.area_count}\n  Invite code: ${loc.invite_code}`,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${data.count} location(s):\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    }),
  );
}

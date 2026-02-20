import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type ApiClient, withErrorHandling } from "../api-client.js";

interface ActivityEntry {
  id: string;
  location_id: string;
  user_id: string;
  user_name: string;
  display_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  changes: Record<string, unknown>;
  auth_method: 'jwt' | 'api_key' | null;
  created_at: string;
}

interface ListResponse {
  results: ActivityEntry[];
  count: number;
}

function formatEntry(entry: ActivityEntry): string {
  const who = entry.display_name || entry.user_name;
  const parts = [`- **${who}** ${entry.action} ${entry.entity_type} "${entry.entity_name}"`];
  const meta = [entry.created_at];
  if (entry.auth_method) meta.push(`via ${entry.auth_method}`);
  parts.push(`  ${meta.join(' | ')}`);

  if (entry.changes && Object.keys(entry.changes).length > 0) {
    const changes = Object.entries(entry.changes)
      .map(([key, val]) => {
        if (typeof val === "object" && val !== null && "old" in val && "new" in val) {
          const v = val as { old: unknown; new: unknown };
          return `${key}: ${v.old} → ${v.new}`;
        }
        return `${key}: ${JSON.stringify(val)}`;
      })
      .join(", ");
    parts.push(`  Changes: ${changes}`);
  }

  return parts.join("\n");
}

export function registerActivityTools(server: McpServer, api: ApiClient) {
  server.tool(
    "get_activity_log",
    "Get the activity log for a location",
    {
      location_id: z.string().describe("Location UUID"),
      limit: z.number().min(1).max(100).optional().describe("Max results (1-100, default 50)"),
      offset: z.number().min(0).optional().describe("Offset for pagination"),
      entity_type: z
        .string()
        .optional()
        .describe("Filter by entity type (e.g. 'bin', 'area', 'photo')"),
      entity_id: z.string().optional().describe("Filter by specific entity UUID"),
    },
    withErrorHandling(async ({ location_id, limit, offset, entity_type, entity_id }) => {
      const params = new URLSearchParams();
      if (limit !== undefined) params.set("limit", String(limit));
      if (offset !== undefined) params.set("offset", String(offset));
      if (entity_type) params.set("entity_type", entity_type);
      if (entity_id) params.set("entity_id", entity_id);

      const query = params.toString();
      const data = await api.get<ListResponse>(
        `/api/locations/${encodeURIComponent(location_id)}/activity${query ? `?${query}` : ""}`,
      );

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "No activity found." }] };
      }

      const lines = data.results.map(formatEntry);

      return {
        content: [
          {
            type: "text" as const,
            text: `${data.count} activity entries${data.results.length < data.count ? ` (showing ${data.results.length})` : ""}:\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    }),
  );
}

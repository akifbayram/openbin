import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type ApiClient, withErrorHandling } from "../api-client.js";

interface Location {
  id: string;
  name: string;
  role: string;
  member_count: number;
  area_count: number;
  invite_code: string;
  activity_retention_days: number;
  trash_retention_days: number;
  app_name: string;
  term_bin: string;
  term_location: string;
  term_area: string;
  created_at: string;
  updated_at: string;
}

interface ListResponse {
  results: Location[];
  count: number;
}

interface Member {
  id: string;
  location_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  display_name: string;
}

interface MemberListResponse {
  results: Member[];
  count: number;
}

function formatLocation(loc: Location): string {
  const parts = [
    `**${loc.name}** (id: ${loc.id})`,
    `Role: ${loc.role} | Members: ${loc.member_count} | Areas: ${loc.area_count}`,
    `Invite code: ${loc.invite_code}`,
  ];
  if (loc.trash_retention_days) parts.push(`Trash retention: ${loc.trash_retention_days} days`);
  return parts.join("\n");
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

      const lines = data.results.map((loc) => formatLocation(loc));

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

  server.tool(
    "create_location",
    "Create a new location",
    {
      name: z.string().describe("Location name"),
    },
    withErrorHandling(async ({ name }) => {
      const loc = await api.post<Location>("/api/locations", { name });

      return {
        content: [
          {
            type: "text" as const,
            text: `Location created!\n\n${formatLocation(loc)}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "update_location",
    "Update a location's settings (admin only)",
    {
      location_id: z.string().describe("Location UUID"),
      name: z.string().optional().describe("New location name"),
      trash_retention_days: z.number().optional().describe("Days to keep trashed bins before permanent deletion"),
      activity_retention_days: z.number().optional().describe("Days to keep activity log entries"),
      app_name: z.string().optional().describe("Custom app name for this location"),
      term_bin: z.string().optional().describe("Custom term for 'bin' (e.g. 'box', 'container')"),
      term_location: z.string().optional().describe("Custom term for 'location'"),
      term_area: z.string().optional().describe("Custom term for 'area'"),
    },
    withErrorHandling(async ({ location_id, name, trash_retention_days, activity_retention_days, app_name, term_bin, term_location, term_area }) => {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (trash_retention_days !== undefined) body.trash_retention_days = trash_retention_days;
      if (activity_retention_days !== undefined) body.activity_retention_days = activity_retention_days;
      if (app_name !== undefined) body.app_name = app_name;
      if (term_bin !== undefined) body.term_bin = term_bin;
      if (term_location !== undefined) body.term_location = term_location;
      if (term_area !== undefined) body.term_area = term_area;

      const loc = await api.put<Location>(`/api/locations/${encodeURIComponent(location_id)}`, body);

      return {
        content: [
          {
            type: "text" as const,
            text: `Location updated!\n\nName: ${loc.name}\nID: ${loc.id}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "delete_location",
    "Delete a location and all its data (admin only, cannot be undone)",
    {
      location_id: z.string().describe("Location UUID"),
    },
    withErrorHandling(async ({ location_id }) => {
      await api.del(`/api/locations/${encodeURIComponent(location_id)}`);

      return {
        content: [{ type: "text" as const, text: "Location deleted." }],
      };
    }),
  );

  server.tool(
    "join_location",
    "Join a location using an invite code",
    {
      invite_code: z.string().describe("Invite code for the location"),
    },
    withErrorHandling(async ({ invite_code }) => {
      const loc = await api.post<Location>("/api/locations/join", { inviteCode: invite_code });

      return {
        content: [
          {
            type: "text" as const,
            text: `Joined location!\n\nName: ${loc.name}\nID: ${loc.id}\nRole: ${loc.role}`,
          },
        ],
      };
    }),
  );

  // --- Members ---

  server.tool(
    "list_location_members",
    "List all members of a location",
    {
      location_id: z.string().describe("Location UUID"),
    },
    withErrorHandling(async ({ location_id }) => {
      const data = await api.get<MemberListResponse>(
        `/api/locations/${encodeURIComponent(location_id)}/members`,
      );

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "No members found." }] };
      }

      const lines = data.results.map(
        (m) => `- **${m.display_name}** (user_id: ${m.user_id})\n  Role: ${m.role} | Joined: ${m.joined_at}`,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `${data.count} member(s):\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    }),
  );

  server.tool(
    "remove_location_member",
    "Remove a member from a location (admin only, or self-removal)",
    {
      location_id: z.string().describe("Location UUID"),
      user_id: z.string().describe("User UUID of the member to remove"),
    },
    withErrorHandling(async ({ location_id, user_id }) => {
      await api.del(
        `/api/locations/${encodeURIComponent(location_id)}/members/${encodeURIComponent(user_id)}`,
      );

      return {
        content: [{ type: "text" as const, text: "Member removed." }],
      };
    }),
  );

  server.tool(
    "update_member_role",
    "Change a member's role in a location (admin only)",
    {
      location_id: z.string().describe("Location UUID"),
      user_id: z.string().describe("User UUID of the member"),
      role: z.enum(["admin", "member"]).describe("New role: 'admin' or 'member'"),
    },
    withErrorHandling(async ({ location_id, user_id, role }) => {
      const result = await api.put<{ message: string }>(
        `/api/locations/${encodeURIComponent(location_id)}/members/${encodeURIComponent(user_id)}/role`,
        { role },
      );

      return {
        content: [{ type: "text" as const, text: result.message }],
      };
    }),
  );

  server.tool(
    "regenerate_invite_code",
    "Generate a new invite code for a location (admin only). Invalidates the previous code.",
    {
      location_id: z.string().describe("Location UUID"),
    },
    withErrorHandling(async ({ location_id }) => {
      const result = await api.post<{ inviteCode: string }>(
        `/api/locations/${encodeURIComponent(location_id)}/regenerate-invite`,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `New invite code: ${result.inviteCode}`,
          },
        ],
      };
    }),
  );
}

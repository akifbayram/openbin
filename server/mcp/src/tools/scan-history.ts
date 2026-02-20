import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type ApiClient, withErrorHandling } from "../api-client.js";

interface ScanEntry {
  id: string;
  bin_id: string;
  scanned_at: string;
}

interface ListResponse {
  results: ScanEntry[];
  count: number;
}

export function registerScanHistoryTools(server: McpServer, api: ApiClient) {
  server.tool(
    "get_scan_history",
    "Get the user's recent QR scan history",
    {
      limit: z.number().min(1).max(100).optional().describe("Max results (1-100, default 20)"),
    },
    withErrorHandling(async ({ limit }) => {
      const params = new URLSearchParams();
      if (limit) params.set("limit", String(limit));

      const query = params.toString();
      const data = await api.get<ListResponse>(
        `/api/scan-history${query ? `?${query}` : ""}`,
      );

      if (data.results.length === 0) {
        return { content: [{ type: "text" as const, text: "No scan history found." }] };
      }

      const lines = data.results.map(
        (entry) => `- Bin ${entry.bin_id} scanned at ${entry.scanned_at}`,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `${data.count} recent scan(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }),
  );
}

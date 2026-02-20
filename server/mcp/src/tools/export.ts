import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type ApiClient, withErrorHandling } from "../api-client.js";

interface ExportPhoto {
  id: string;
  filename: string;
  mimeType: string;
}

interface ExportBin {
  id: string;
  name: string;
  location: string;
  items: string[];
  notes: string;
  tags: string[];
  icon: string;
  color: string;
  shortCode: string;
  createdAt: string;
  updatedAt: string;
  photos: ExportPhoto[];
}

interface ExportData {
  version: number;
  exportedAt: string;
  locationName: string;
  bins: ExportBin[];
}

export function registerExportTools(server: McpServer, api: ApiClient) {
  server.tool(
    "export_location_json",
    "Export all bins in a location as JSON",
    {
      location_id: z.string().describe("Location UUID"),
    },
    withErrorHandling(async ({ location_id }) => {
      const data = await api.get<ExportData>(
        `/api/locations/${encodeURIComponent(location_id)}/export`,
      );

      const summary = [
        `**${data.locationName}** — exported ${data.bins.length} bin(s)`,
        `Exported at: ${data.exportedAt}`,
      ];

      for (const bin of data.bins) {
        const parts = [`- **${bin.name}** (${bin.shortCode})`];
        if (bin.location) parts.push(`  Area: ${bin.location}`);
        if (bin.items.length > 0) parts.push(`  Items: ${bin.items.join(", ")}`);
        if (bin.tags.length > 0) parts.push(`  Tags: ${bin.tags.join(", ")}`);
        if (bin.notes) parts.push(`  Notes: ${bin.notes}`);
        if (bin.photos.length > 0) parts.push(`  Photos: ${bin.photos.length}`);
        summary.push(parts.join("\n"));
      }

      return {
        content: [{ type: "text" as const, text: summary.join("\n\n") }],
      };
    }),
  );

  server.tool(
    "export_location_csv",
    "Export all bins in a location as CSV text",
    {
      location_id: z.string().describe("Location UUID"),
    },
    withErrorHandling(async ({ location_id }) => {
      const csv = await api.getText(
        `/api/locations/${encodeURIComponent(location_id)}/export/csv`,
      );

      return {
        content: [{ type: "text" as const, text: csv }],
      };
    }),
  );
}

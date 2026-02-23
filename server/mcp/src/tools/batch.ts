import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type ApiClient, withErrorHandling } from "../api-client.js";

interface ActionResult {
  type: string;
  success: boolean;
  details: string;
  bin_id?: string;
  bin_name?: string;
  error?: string;
}

interface BatchResponse {
  results: ActionResult[];
  errors: string[];
}

const OperationSchema = z.object({
  type: z.enum([
    "create_bin", "update_bin", "delete_bin", "restore_bin",
    "add_items", "remove_items", "modify_item",
    "add_tags", "remove_tags", "modify_tag",
    "set_area", "set_notes", "set_icon", "set_color",
  ]).describe("Operation type"),
  bin_id: z.string().optional().describe("Bin UUID (required for all types except create_bin)"),
  bin_name: z.string().optional().describe("Bin name (for logging; required for existing-bin operations)"),
  name: z.string().optional().describe("Bin name (create_bin, update_bin)"),
  items: z.array(z.string()).optional().describe("Item names (add_items, remove_items, create_bin)"),
  tags: z.array(z.string()).optional().describe("Tag names (add_tags, remove_tags, create_bin, update_bin)"),
  notes: z.string().optional().describe("Notes text (set_notes, create_bin, update_bin)"),
  mode: z.enum(["set", "append", "clear"]).optional().describe("Notes mode (set_notes only)"),
  area_id: z.string().nullable().optional().describe("Area UUID (set_area)"),
  area_name: z.string().optional().describe("Area name — auto-creates if needed (set_area, create_bin, update_bin)"),
  icon: z.string().optional().describe("Icon identifier (set_icon, create_bin, update_bin)"),
  color: z.string().optional().describe("Color value (set_color, create_bin, update_bin)"),
  card_style: z.string().optional().describe('Card style JSON (create_bin, update_bin). Variants: "glass" (default, omit or empty string), "border" ({variant,secondaryColor,borderWidth,borderStyle}), "gradient" ({variant,secondaryColor}), "stripe" ({variant,secondaryColor,stripePosition:left|right|top|bottom,stripeWidth}), "photo" ({variant,coverPhotoId})'),
  old_item: z.string().optional().describe("Old item name (modify_item)"),
  new_item: z.string().optional().describe("New item name (modify_item)"),
  old_tag: z.string().optional().describe("Old tag name (modify_tag)"),
  new_tag: z.string().optional().describe("New tag name (modify_tag)"),
  visibility: z.enum(["location", "private"]).optional().describe("Bin visibility (update_bin)"),
});

export function registerBatchTools(server: McpServer, api: ApiClient) {
  server.tool(
    "batch_operations",
    "Execute multiple bin operations in a single transaction (up to 50). Supports: create_bin, update_bin, delete_bin, restore_bin, add_items, remove_items, modify_item, add_tags, remove_tags, modify_tag, set_area, set_notes, set_icon, set_color.",
    {
      location_id: z.string().describe("Location UUID"),
      operations: z.array(OperationSchema).min(1).max(50).describe("Array of operations to execute"),
    },
    withErrorHandling(async ({ location_id, operations }) => {
      const data = await api.post<BatchResponse>("/api/batch", {
        locationId: location_id,
        operations,
      });

      const lines: string[] = [];

      if (data.results.length > 0) {
        const succeeded = data.results.filter((r) => r.success);
        const failed = data.results.filter((r) => !r.success);

        if (succeeded.length > 0) {
          lines.push(`**${succeeded.length} succeeded:**`);
          for (const r of succeeded) {
            lines.push(`- ${r.details}`);
          }
        }

        if (failed.length > 0) {
          lines.push(`\n**${failed.length} failed:**`);
          for (const r of failed) {
            lines.push(`- [${r.type}] ${r.error || r.details}`);
          }
        }
      }

      if (data.errors.length > 0) {
        lines.push(`\n**Errors:** ${data.errors.join("; ")}`);
      }

      if (lines.length === 0) {
        lines.push("No operations were executed.");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }),
  );
}

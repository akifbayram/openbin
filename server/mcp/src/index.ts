import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ApiClient, OpenBinApiError } from "./api-client.js";
import { registerLocationTools } from "./tools/locations.js";
import { registerAreaTools } from "./tools/areas.js";
import { registerBinTools } from "./tools/bins.js";
import { registerItemTools } from "./tools/items.js";
import { registerTagTools } from "./tools/tags.js";
import { registerScanHistoryTools } from "./tools/scan-history.js";
import { registerExportTools } from "./tools/export.js";
import { registerActivityTools } from "./tools/activity.js";
import { registerBatchTools } from "./tools/batch.js";

const apiKey = process.env.OPENBIN_API_KEY;
if (!apiKey) {
  console.error("OPENBIN_API_KEY environment variable is required");
  process.exit(1);
}

const apiUrl = process.env.OPENBIN_API_URL || "http://localhost:1453";
const api = new ApiClient(apiUrl, apiKey);

const server = new McpServer({
  name: "openbin",
  version: "1.0.0",
});

registerLocationTools(server, api);
registerAreaTools(server, api);
registerBinTools(server, api);
registerItemTools(server, api);
registerTagTools(server, api);
registerScanHistoryTools(server, api);
registerExportTools(server, api);
registerActivityTools(server, api);
registerBatchTools(server, api);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`OpenBin MCP server running (API: ${apiUrl})`);
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});

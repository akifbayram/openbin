# MCP Server

OpenBin includes a standalone MCP (Model Context Protocol) server that connects AI assistants like Claude directly to your inventory. It runs as a separate Node.js process, bridging Claude and the OpenBin REST API so you can manage bins, items, tags, areas, and locations through natural conversation instead of navigating the UI.

## What is MCP?

MCP (Model Context Protocol) is an open standard for connecting AI assistants to external tools and data sources. OpenBin's MCP server exposes 43 tools that let Claude read, search, create, and manage your entire inventory. You ask questions or give instructions in plain language, and Claude calls the appropriate OpenBin API endpoints behind the scenes.

## Prerequisites

- OpenBin running (Docker or local development)
- An API key created in OpenBin (Settings > API Keys)
- Node.js 20+ (for building the MCP server)
- Claude Desktop or another MCP-compatible client

## Setup

### 1. Build the MCP server

```bash
cd server/mcp
npm install
npm run build
```

### 2. Create an API key

1. Log into OpenBin
2. Go to **Settings > API Keys > Create Key**
3. Copy the key (starts with `sk_openbin_...`)

::: warning
Store your API key securely. It grants full access to every location your account belongs to. You cannot view the key again after creation.
:::

### 3. Configure your MCP client

**For Claude Desktop**, add to your Claude Desktop configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "openbin": {
      "command": "node",
      "args": ["/absolute/path/to/server/mcp/dist/index.js"],
      "env": {
        "OPENBIN_API_KEY": "sk_openbin_your_key_here",
        "OPENBIN_API_URL": "http://localhost:1453"
      }
    }
  }
}
```

**For Claude Code**, add a `.mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "openbin": {
      "command": "node",
      "args": ["./server/mcp/dist/index.js"],
      "env": {
        "OPENBIN_API_KEY": "sk_openbin_your_key_here",
        "OPENBIN_API_URL": "http://localhost:1453"
      }
    }
  }
}
```

::: tip
Use an absolute path in the `args` array for Claude Desktop. Relative paths work in Claude Code's `.mcp.json` since it resolves from the project root.
:::

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENBIN_API_KEY` | Yes | -- | API key for authentication (starts with `sk_openbin_...`) |
| `OPENBIN_API_URL` | No | `http://localhost:3000` | Base URL of your OpenBin server |

::: info
If you run OpenBin via Docker with the default `docker-compose.yml`, the external port is typically `1453`. Set `OPENBIN_API_URL` to `http://localhost:1453` in that case. If the MCP server runs inside the same Docker network, use `http://openbin:3000` instead.
:::

### 4. Verify connection

Start Claude and ask:

> "List my OpenBin locations"

If configured correctly, Claude will call the `list_locations` tool and return your locations with their names, member counts, and invite codes.

## Available Tools

The MCP server exposes 43 tools organized into 9 categories.

### Locations (9 tools)

| Tool | Description |
|---|---|
| `list_locations` | List all locations the authenticated user belongs to |
| `create_location` | Create a new location |
| `update_location` | Update a location's settings such as name, trash retention, custom terminology (admin only) |
| `delete_location` | Delete a location and all its data permanently (admin only) |
| `join_location` | Join a location using an invite code |
| `list_location_members` | List all members of a location with their roles |
| `remove_location_member` | Remove a member from a location (admin only, or self-removal) |
| `update_member_role` | Change a member's role to admin or member (admin only) |
| `regenerate_invite_code` | Generate a new invite code, invalidating the previous one (admin only) |

### Areas (4 tools)

| Tool | Description |
|---|---|
| `list_areas` | List all areas within a location |
| `create_area` | Create a new area within a location (admin only) |
| `rename_area` | Rename an existing area (admin only) |
| `delete_area` | Delete an area (admin only); bins in the area become unassigned |

### Bins (14 tools)

| Tool | Description |
|---|---|
| `search_bins` | Search bins in a location with optional text query, tag, area, sort, and pagination filters |
| `get_bin` | Get a single bin by UUID or 6-character short code |
| `create_bin` | Create a new bin with optional items, tags, notes, area, icon, color, and card style |
| `update_bin` | Update an existing bin's name, items, tags, notes, area, icon, color, or card style |
| `delete_bin` | Soft-delete a bin (moves to trash, can be restored) |
| `list_trash` | List soft-deleted bins in a location's trash |
| `restore_bin` | Restore a soft-deleted bin from trash |
| `permanent_delete_bin` | Permanently delete a bin from trash (cannot be undone) |
| `list_pinned_bins` | List pinned bins for the current user in a location |
| `pin_bin` | Pin a bin for quick access |
| `unpin_bin` | Unpin a bin |
| `reorder_pinned_bins` | Reorder pinned bins by providing bin UUIDs in the desired order |
| `add_tags` | Add tags to a bin (merges with existing tags, does not replace them) |
| `move_bin` | Move a bin to a different location (admin only); area is unassigned after move |

### Items (5 tools)

| Tool | Description |
|---|---|
| `search_items` | Search items across all bins in a location with optional text query, sort, and pagination |
| `add_items` | Add one or more items to a bin |
| `remove_item` | Remove a single item from a bin by item UUID or name (case-insensitive) |
| `rename_item` | Rename an item within a bin by item UUID or name |
| `reorder_items` | Reorder items within a bin by providing UUIDs or names in the desired order |

### Tags (4 tools)

| Tool | Description |
|---|---|
| `list_tags` | List all tags used in a location with usage counts |
| `list_tag_colors` | List all tag color assignments for a location |
| `set_tag_color` | Set or update the display color for a tag in a location |
| `delete_tag_color` | Remove the color assignment for a tag |

### Scan History (3 tools)

| Tool | Description |
|---|---|
| `get_scan_history` | Get the user's recent QR scan history |
| `record_scan` | Record a QR scan for a bin (updates scan history) |
| `clear_scan_history` | Clear all scan history for the current user |

### Export (2 tools)

| Tool | Description |
|---|---|
| `export_location_json` | Export all bins in a location as formatted JSON with items, tags, notes, and photo counts |
| `export_location_csv` | Export all bins in a location as CSV text |

### Activity (1 tool)

| Tool | Description |
|---|---|
| `get_activity_log` | Get the activity log for a location with optional filters for entity type, entity ID, pagination |

### Batch Operations (1 tool)

| Tool | Description |
|---|---|
| `batch_operations` | Execute up to 50 bin operations in a single transaction |

The `batch_operations` tool supports 14 operation types:

- **Bin lifecycle:** `create_bin`, `update_bin`, `delete_bin`, `restore_bin`
- **Items:** `add_items`, `remove_items`, `modify_item`
- **Tags:** `add_tags`, `remove_tags`, `modify_tag`
- **Properties:** `set_area`, `set_notes`, `set_icon`, `set_color`

Each operation can reference an `area_name` instead of an `area_id` -- the server auto-creates the area if it does not exist.

## Usage Examples

Once the MCP server is connected, you can interact with your inventory through natural conversation:

### Searching inventory

> "Where did I put the holiday decorations?"

Claude will use `search_items` and `search_bins` to find bins containing items matching "holiday decorations" and tell you the bin name, area, and other items stored alongside them.

### Creating bins

> "Create a new bin called 'Power Tools' in the Garage area with items: drill, circular saw, jigsaw"

Claude will call `create_bin` with the name, area, and item list. If the Garage area doesn't exist yet, you can create it first or use `batch_operations` with `area_name` to auto-create it.

### Updating inventory

> "Add 'batteries' and 'charger' to the Power Tools bin"

Claude will search for the bin by name, then call `add_items` to append the new items without removing existing ones.

### Bulk operations

> "Tag all bins in the Kitchen area with 'kitchen' and 'home'"

Claude will use `search_bins` to find all bins in the Kitchen area, then call `batch_operations` with an `add_tags` operation for each bin in a single transaction.

### Exporting data

> "Export all my bins as CSV"

Claude will call `export_location_csv` and return the full CSV output, which you can copy or save to a file.

### Reviewing activity

> "Show me what changed in the last 24 hours"

Claude will call `get_activity_log` and summarize recent actions -- who created, updated, or deleted bins, with change details.

## Development

### Running in development mode

```bash
cd server/mcp
npm run dev
```

This uses `tsx` for direct TypeScript execution without a build step.

### Building for production

```bash
cd server/mcp
npm run build
npm start
```

The `build` script runs `tsc` to compile TypeScript to `dist/`. The `start` script runs the compiled output with Node.js.

### Project structure

```
server/mcp/
├── src/
│   ├── index.ts           # Server entry point and tool registration
│   ├── api-client.ts      # HTTP client for OpenBin API
│   └── tools/
│       ├── locations.ts   # Location and member management (9 tools)
│       ├── areas.ts       # Area management (4 tools)
│       ├── bins.ts        # Bin CRUD, trash, pins, tags, move (14 tools)
│       ├── items.ts       # Item search, add, remove, rename, reorder (5 tools)
│       ├── tags.ts        # Tag listing and color management (4 tools)
│       ├── scan-history.ts # QR scan history (3 tools)
│       ├── export.ts      # JSON and CSV export (2 tools)
│       ├── activity.ts    # Activity log (1 tool)
│       └── batch.ts       # Batch operations (1 tool)
├── package.json
├── tsconfig.json
└── dist/                  # Compiled output (after build)
```

### How it works

The MCP server uses the `@modelcontextprotocol/sdk` to expose tools over stdio transport. Each tool category is registered by a `register*Tools()` function that defines tool names, Zod parameter schemas, and handler functions. The `ApiClient` class makes authenticated HTTP requests to the OpenBin REST API using the configured API key (sent as a `Bearer` token). All tool handlers are wrapped with `withErrorHandling()`, which catches API errors and returns them as structured error messages to the AI client.

## Troubleshooting

### "OPENBIN_API_KEY environment variable is required"

The MCP server could not find the API key. Make sure the `env` section of your MCP client configuration includes `OPENBIN_API_KEY` with a valid key.

### Connection refused

The OpenBin server is not running or the URL is wrong. Verify:

1. OpenBin is running (`docker compose ps` or check `http://localhost:1453` in a browser)
2. `OPENBIN_API_URL` matches the actual server address and port
3. If running in Docker, ensure the MCP server can reach the container (use `http://localhost:1453` from the host, or `http://openbin:3000` from within the Docker network)

### "FORBIDDEN" or "UNAUTHORIZED" errors

Your API key may be revoked or invalid. Go to **Settings > API Keys** in OpenBin to verify the key is active. If needed, create a new key and update your MCP configuration.

### Tools not appearing in Claude

1. Make sure you ran `npm run build` in `server/mcp/` -- Claude needs the compiled `dist/index.js`
2. Verify the `args` path in your MCP config points to the correct `dist/index.js` location
3. Restart Claude Desktop after changing the MCP configuration
4. Check the Claude Desktop logs for MCP connection errors

### "No locations found" when you have data

The API key is tied to the user who created it. Make sure you are querying locations that this user belongs to. If you just created a fresh API key for a new account, you may need to create or join a location first.

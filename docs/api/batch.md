---
title: Batch
---

# Batch

::: tip User Guide
For bulk UI operations, see [Bulk Operations](/guide/bulk-operations).
:::

Execute up to 50 bin operations atomically in a single request.

---

### POST /api/batch

Executes multiple bin operations in one transaction. Uses a partial-success model: individual operation failures are reported in the `errors` array while the remaining successful operations are committed. Ideal for AI agents, MCP integrations, and bulk workflows.

Rate limits: 60/hour for JWT auth; 600/hour for API keys.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `locationId` | UUID | Yes | Location to execute operations in |
| `operations` | array | Yes | 1–50 operation objects |

**Operation object fields**

| Field | Type | Applicable to | Description |
|---|---|---|---|
| `type` | string | All | Operation type (see below) |
| `bin_id` | UUID | All except `create_bin` | Target bin ID |
| `bin_name` | string | All except `create_bin` | Bin name (for logging) |
| `name` | string | `create_bin`, `update_bin` | Bin name |
| `items` | string[] | `add_items`, `remove_items`, `create_bin` | Item names |
| `tags` | string[] | `add_tags`, `remove_tags`, `create_bin`, `update_bin` | Tag names |
| `notes` | string | `set_notes`, `create_bin`, `update_bin` | Notes text |
| `mode` | `"set"`, `"append"`, `"clear"` | `set_notes` | Notes update mode |
| `area_id` | UUID or null | `set_area` | Area UUID; null to unassign |
| `area_name` | string | `set_area`, `create_bin`, `update_bin` | Area name; auto-creates if needed |
| `icon` | string | `set_icon`, `create_bin`, `update_bin` | Icon identifier |
| `color` | string | `set_color`, `create_bin`, `update_bin` | Color value |
| `old_item` | string | `modify_item` | Current item name to rename |
| `new_item` | string | `modify_item` | New item name |
| `old_tag` | string | `modify_tag` | Current tag name to rename |
| `new_tag` | string | `modify_tag` | New tag name |
| `visibility` | `"location"` or `"private"` | `update_bin` | Bin visibility |

**Supported operation types**: `create_bin`, `update_bin`, `delete_bin`, `restore_bin`, `add_items`, `remove_items`, `modify_item`, `add_tags`, `remove_tags`, `modify_tag`, `set_area`, `set_notes`, `set_icon`, `set_color`.

**Example request**

```json
{
  "locationId": "550e8400-e29b-41d4-a716-446655440000",
  "operations": [
    {
      "type": "add_tags",
      "bin_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "bin_name": "Tools",
      "tags": ["fragile"]
    },
    {
      "type": "set_area",
      "bin_id": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "bin_name": "Supplies",
      "area_name": "Garage"
    },
    {
      "type": "create_bin",
      "name": "New Bin",
      "items": ["item1"],
      "tags": ["new"]
    }
  ]
}
```

**Response (200)**

```json
{
  "results": [
    {
      "type": "add_tags",
      "success": true,
      "details": "Added tags [fragile] to Tools",
      "bin_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "bin_name": "Tools"
    },
    {
      "type": "set_area",
      "success": true,
      "details": "Set area of Supplies to \"Garage\"",
      "bin_id": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "bin_name": "Supplies"
    },
    {
      "type": "create_bin",
      "success": true,
      "details": "Created bin \"New Bin\"",
      "bin_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "bin_name": "New Bin"
    }
  ],
  "errors": []
}
```

import {ArrowUpDown, CircleHelp,
  Copy, FileText, FolderMinus, FolderPen, Hash, Image as ImageIcon, LogIn, LogOut, MapPin, Minus, Package, Palette, PenLine, Pin, PinOff,
  Plus, Tag, Trash2, Undo2,
} from 'lucide-react';
import type { Terminology } from '@/lib/terminology';
import type { CommandAction } from './useCommand';

/** Visible placeholder shown when an action's bin_name is missing AND no map entry resolves it. */
const UNKNOWN_BIN_LABEL = 'a bin';

export function isBinCreatingAction(action: CommandAction): boolean {
  return action.type === 'create_bin' || action.type === 'duplicate_bin';
}

/**
 * Fill in missing `bin_name` (and `target_bin_name` for return_item) on AI
 * command actions using a local bin_id → bin name map. Providers (notably
 * Gemini) sometimes omit these optional fields even though the system prompt
 * and few-shot examples require them — the raw JSON is otherwise shown to the
 * user as `Delete "undefined"`. Pure function: does not mutate input.
 */
export function enrichActionsWithNames(
  actions: CommandAction[],
  binMap: Map<string, { name: string }>,
): CommandAction[] {
  return actions.map((action) => {
    let next = action;
    if ('bin_id' in action && typeof action.bin_id === 'string') {
      const hasName = 'bin_name' in action && typeof (action as { bin_name?: unknown }).bin_name === 'string' && (action as { bin_name: string }).bin_name.length > 0;
      if (!hasName) {
        const name = binMap.get(action.bin_id)?.name;
        if (name) next = { ...action, bin_name: name } as CommandAction;
      }
    }
    if (next.type === 'return_item' && next.target_bin_id && !next.target_bin_name) {
      const target = binMap.get(next.target_bin_id)?.name;
      if (target) next = { ...next, target_bin_name: target };
    }
    return next;
  });
}

/** Read bin_name from action, falling back to a readable placeholder. */
function resolveBinName(action: CommandAction): string {
  const name = (action as { bin_name?: unknown }).bin_name;
  return typeof name === 'string' && name.length > 0 ? name : UNKNOWN_BIN_LABEL;
}

export function isDestructiveAction(action: CommandAction): boolean {
  return action.type === 'delete_bin' || action.type === 'remove_items' || action.type === 'remove_tags'
    || action.type === 'delete_area' || action.type === 'unpin_bin';
}

export function getActionIcon(action: CommandAction) {
  switch (action.type) {
    case 'add_items': return Plus;
    case 'remove_items': return Minus;
    case 'modify_item': return FileText;
    case 'set_item_quantity': return Hash;
    case 'create_bin': return Package;
    case 'delete_bin': return Trash2;
    case 'add_tags': return Tag;
    case 'remove_tags': return Tag;
    case 'modify_tag': return Tag;
    case 'set_area': return MapPin;
    case 'set_notes': return FileText;
    case 'set_icon': return ImageIcon;
    case 'set_color': return Palette;
    case 'update_bin': return PenLine;
    case 'restore_bin': return Undo2;
    case 'duplicate_bin': return Copy;
    case 'pin_bin': return Pin;
    case 'unpin_bin': return PinOff;
    case 'rename_area': return FolderPen;
    case 'delete_area': return FolderMinus;
    case 'set_tag_color': return Palette;
    case 'reorder_items': return ArrowUpDown;
    case 'checkout_item': return LogOut;
    case 'return_item': return LogIn;
    default: return CircleHelp;
  }
}

export function describeAction(action: CommandAction, t: Terminology): string {
  const binName = resolveBinName(action);
  switch (action.type) {
    case 'add_items':
      return `Add ${action.items.map((i) => typeof i === 'string' ? i : (i.quantity ? `${i.name} (×${i.quantity})` : i.name)).join(', ')} to "${binName}"`;
    case 'remove_items':
      return `Remove ${action.items.join(', ')} from "${binName}"`;
    case 'modify_item':
      return `Rename "${action.old_item}" to "${action.new_item}" in "${binName}"`;
    case 'set_item_quantity':
      return action.quantity <= 0
        ? `Remove "${action.item_name}" from "${binName}"`
        : `Set quantity of "${action.item_name}" to ${action.quantity} in "${binName}"`;
    case 'create_bin': {
      let desc = `Create ${t.bin} "${action.name}"`;
      if (action.area_name) desc += ` in ${action.area_name}`;
      if (action.items?.length) desc += ` with ${action.items.length} item${action.items.length !== 1 ? 's' : ''}`;
      return desc;
    }
    case 'delete_bin':
      return `Delete "${binName}"`;
    case 'add_tags':
      return `Add tag${action.tags.length !== 1 ? 's' : ''} ${action.tags.join(', ')} to "${binName}"`;
    case 'remove_tags':
      return `Remove tag${action.tags.length !== 1 ? 's' : ''} ${action.tags.join(', ')} from "${binName}"`;
    case 'modify_tag':
      return `Rename tag "${action.old_tag}" to "${action.new_tag}" on "${binName}"`;
    case 'set_area':
      return `Move "${binName}" to ${t.area} "${action.area_name}"`;
    case 'set_notes':
      if (action.mode === 'clear') return `Clear notes on "${binName}"`;
      if (action.mode === 'append') return `Append to notes on "${binName}"`;
      return `Set notes on "${binName}"`;
    case 'set_icon':
      return `Set icon on "${binName}" to ${action.icon}`;
    case 'set_color':
      return `Set color on "${binName}" to ${action.color}`;
    case 'update_bin': {
      const fields = ['name', 'notes', 'tags', 'area_name', 'icon', 'color', 'visibility'].filter((f) => (action as Record<string, unknown>)[f] !== undefined);
      return `Update "${binName}": ${fields.join(', ')}`;
    }
    case 'restore_bin':
      return `Restore "${binName}" from trash`;
    case 'duplicate_bin':
      return action.new_name ? `Duplicate "${binName}" as "${action.new_name}"` : `Duplicate "${binName}"`;
    case 'pin_bin':
      return `Pin "${binName}"`;
    case 'unpin_bin':
      return `Unpin "${binName}"`;
    case 'rename_area':
      return `Rename ${t.area} "${action.area_name}" to "${action.new_name}"`;
    case 'delete_area':
      return `Delete ${t.area} "${action.area_name}"`;
    case 'set_tag_color':
      return `Set color of tag "${action.tag}" to ${action.color}`;
    case 'reorder_items':
      return `Reorder items in "${binName}"`;
    case 'checkout_item':
      return `Check out "${action.item_name}" from "${binName}"`;
    case 'return_item':
      return action.target_bin_name
        ? `Return "${action.item_name}" to "${action.target_bin_name}"`
        : `Return "${action.item_name}" to "${binName}"`;
    default:
      return `Unknown action: ${(action as Record<string, unknown>).type}`;
  }
}

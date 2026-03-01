import {ArrowUpDown, 
  Copy, FileText, FolderMinus, FolderPen, Image as ImageIcon,MapPin, Minus, Package, Palette, PenLine,Pin, PinOff, 
  Plus, Tag, Trash2, Undo2, 
} from 'lucide-react';
import type { Terminology } from '@/lib/terminology';
import type { CommandAction } from './useCommand';

export function isDestructiveAction(action: CommandAction): boolean {
  return action.type === 'delete_bin' || action.type === 'remove_items' || action.type === 'remove_tags'
    || action.type === 'delete_area' || action.type === 'unpin_bin';
}

export function getActionIcon(action: CommandAction) {
  switch (action.type) {
    case 'add_items': return Plus;
    case 'remove_items': return Minus;
    case 'modify_item': return FileText;
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
  }
}

export function describeAction(action: CommandAction, t: Terminology): string {
  switch (action.type) {
    case 'add_items':
      return `Add ${action.items.join(', ')} to "${action.bin_name}"`;
    case 'remove_items':
      return `Remove ${action.items.join(', ')} from "${action.bin_name}"`;
    case 'modify_item':
      return `Rename "${action.old_item}" to "${action.new_item}" in "${action.bin_name}"`;
    case 'create_bin': {
      let desc = `Create ${t.bin} "${action.name}"`;
      if (action.area_name) desc += ` in ${action.area_name}`;
      if (action.items?.length) desc += ` with ${action.items.length} item${action.items.length !== 1 ? 's' : ''}`;
      return desc;
    }
    case 'delete_bin':
      return `Delete "${action.bin_name}"`;
    case 'add_tags':
      return `Add tag${action.tags.length !== 1 ? 's' : ''} ${action.tags.join(', ')} to "${action.bin_name}"`;
    case 'remove_tags':
      return `Remove tag${action.tags.length !== 1 ? 's' : ''} ${action.tags.join(', ')} from "${action.bin_name}"`;
    case 'modify_tag':
      return `Rename tag "${action.old_tag}" to "${action.new_tag}" on "${action.bin_name}"`;
    case 'set_area':
      return `Move "${action.bin_name}" to ${t.area} "${action.area_name}"`;
    case 'set_notes':
      if (action.mode === 'clear') return `Clear notes on "${action.bin_name}"`;
      if (action.mode === 'append') return `Append to notes on "${action.bin_name}"`;
      return `Set notes on "${action.bin_name}"`;
    case 'set_icon':
      return `Set icon on "${action.bin_name}" to ${action.icon}`;
    case 'set_color':
      return `Set color on "${action.bin_name}" to ${action.color}`;
    case 'update_bin': {
      const fields = ['name', 'notes', 'tags', 'area_name', 'icon', 'color', 'visibility'].filter((f) => (action as Record<string, unknown>)[f] !== undefined);
      return `Update "${action.bin_name}": ${fields.join(', ')}`;
    }
    case 'restore_bin':
      return `Restore "${action.bin_name}" from trash`;
    case 'duplicate_bin':
      return action.new_name ? `Duplicate "${action.bin_name}" as "${action.new_name}"` : `Duplicate "${action.bin_name}"`;
    case 'pin_bin':
      return `Pin "${action.bin_name}"`;
    case 'unpin_bin':
      return `Unpin "${action.bin_name}"`;
    case 'rename_area':
      return `Rename ${t.area} "${action.area_name}" to "${action.new_name}"`;
    case 'delete_area':
      return `Delete ${t.area} "${action.area_name}"`;
    case 'set_tag_color':
      return `Set color of tag "${action.tag}" to ${action.color}`;
    case 'reorder_items':
      return `Reorder items in "${action.bin_name}"`;
  }
}

import {
  Plus, Minus, Package, Trash2, Tag, MapPin, FileText, Palette, Image as ImageIcon,
} from 'lucide-react';
import type { CommandAction } from './useCommand';
import type { Terminology } from '@/lib/terminology';

export function isDestructiveAction(action: CommandAction): boolean {
  return action.type === 'delete_bin' || action.type === 'remove_items' || action.type === 'remove_tags';
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
  }
}

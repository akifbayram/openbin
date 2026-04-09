
export type CommandAction =
  | { type: 'add_items'; bin_id: string; bin_name: string; items: (string | { name: string; quantity?: number })[] }
  | { type: 'remove_items'; bin_id: string; bin_name: string; items: string[] }
  | { type: 'modify_item'; bin_id: string; bin_name: string; old_item: string; new_item: string }
  | { type: 'create_bin'; name: string; area_name?: string; tags?: string[]; items?: (string | { name: string; quantity?: number })[]; color?: string; icon?: string; notes?: string }
  | { type: 'delete_bin'; bin_id: string; bin_name: string }
  | { type: 'add_tags'; bin_id: string; bin_name: string; tags: string[] }
  | { type: 'remove_tags'; bin_id: string; bin_name: string; tags: string[] }
  | { type: 'modify_tag'; bin_id: string; bin_name: string; old_tag: string; new_tag: string }
  | { type: 'set_area'; bin_id: string; bin_name: string; area_id: string | null; area_name: string }
  | { type: 'set_notes'; bin_id: string; bin_name: string; notes: string; mode: 'set' | 'append' | 'clear' }
  | { type: 'set_icon'; bin_id: string; bin_name: string; icon: string }
  | { type: 'set_color'; bin_id: string; bin_name: string; color: string }
  | { type: 'update_bin'; bin_id: string; bin_name: string; name?: string; notes?: string; tags?: string[]; area_name?: string; icon?: string; color?: string; visibility?: 'location' | 'private' }
  | { type: 'restore_bin'; bin_id: string; bin_name: string }
  | { type: 'duplicate_bin'; bin_id: string; bin_name: string; new_name?: string }
  | { type: 'pin_bin'; bin_id: string; bin_name: string }
  | { type: 'unpin_bin'; bin_id: string; bin_name: string }
  | { type: 'rename_area'; area_id: string; area_name: string; new_name: string }
  | { type: 'delete_area'; area_id: string; area_name: string }
  | { type: 'set_tag_color'; tag: string; color: string }
  | { type: 'reorder_items'; bin_id: string; bin_name: string; item_ids: string[] };

export interface CommandResult {
  actions: CommandAction[];
  interpretation: string;
}


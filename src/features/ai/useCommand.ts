import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { mapAiError } from './aiErrors';

export type CommandAction =
  | { type: 'add_items'; bin_id: string; bin_name: string; items: string[] }
  | { type: 'remove_items'; bin_id: string; bin_name: string; items: string[] }
  | { type: 'modify_item'; bin_id: string; bin_name: string; old_item: string; new_item: string }
  | { type: 'create_bin'; name: string; area_name?: string; tags?: string[]; items?: string[]; color?: string; icon?: string; notes?: string }
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

/** @deprecated Use mapAiError from aiErrors.ts instead */
export function mapCommandErrorMessage(err: unknown): string {
  return mapAiError(err, 'Couldn\'t understand that command — try rephrasing');
}

export async function parseCommandText(options: {
  text: string;
  locationId: string;
}): Promise<CommandResult> {
  return apiFetch<CommandResult>('/api/ai/command', {
    method: 'POST',
    body: {
      text: options.text,
      locationId: options.locationId,
    },
  });
}

export function useCommand() {
  const [actions, setActions] = useState<CommandAction[] | null>(null);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parse = useCallback(async (options: { text: string; locationId: string }) => {
    setIsParsing(true);
    setError(null);
    setActions(null);
    setInterpretation(null);
    try {
      const result = await parseCommandText(options);
      setActions(result.actions);
      setInterpretation(result.interpretation);
      return result;
    } catch (err) {
      setError(mapAiError(err, 'Couldn\'t understand that command — try rephrasing'));
      return null;
    } finally {
      setIsParsing(false);
    }
  }, []);

  const clearCommand = useCallback(() => {
    setActions(null);
    setInterpretation(null);
    setError(null);
  }, []);

  return { actions, interpretation, isParsing, error, parse, clearCommand };
}

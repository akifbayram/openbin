import { querySync } from '../../db.js';
import type { ActionResult } from '../commandExecutor.js';
import type { CommandAction } from '../commandParser.js';
import type { ActionContext } from './types.js';

export function handlePinBin(action: Extract<CommandAction, { type: 'pin_bin' }>, ctx: ActionContext): ActionResult {
  const bin = querySync('SELECT id FROM bins WHERE id = $1 AND deleted_at IS NULL', [action.bin_id]);
  if (bin.rows.length === 0) throw new Error(`Bin not found: ${action.bin_name}`);
  querySync(
    'INSERT OR IGNORE INTO pinned_bins (user_id, bin_id, position) VALUES ($1, $2, (SELECT COALESCE(MAX(position),0)+1 FROM pinned_bins WHERE user_id = $1))',
    [ctx.userId, action.bin_id]
  );
  return { type: 'pin_bin', success: true, details: `Pinned "${action.bin_name}"`, bin_id: action.bin_id, bin_name: action.bin_name };
}

export function handleUnpinBin(action: Extract<CommandAction, { type: 'unpin_bin' }>, ctx: ActionContext): ActionResult {
  querySync('DELETE FROM pinned_bins WHERE user_id = $1 AND bin_id = $2', [ctx.userId, action.bin_id]);
  return { type: 'unpin_bin', success: true, details: `Unpinned "${action.bin_name}"`, bin_id: action.bin_id, bin_name: action.bin_name };
}

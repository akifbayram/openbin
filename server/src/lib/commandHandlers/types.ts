import type { TxQueryFn } from '../../db.js';
import type { ActionResult } from '../commandExecutor.js';
import type { CommandAction } from '../commandParser.js';

export interface ActionContext {
  locationId: string;
  userId: string;
  userName: string;
  pendingActivities: PendingActivity[];
  authMethod?: 'jwt' | 'api_key';
  apiKeyId?: string;
}

/** Throw if a private bin is being accessed by someone other than its creator.
 *  Mirrors the visibility check in verifyBinAccess() used by direct routes. */
export function assertBinVisible(bin: { visibility: string; created_by: string }, userId: string): void {
  if (bin.visibility === 'private' && bin.created_by !== userId) {
    throw new Error('Bin not found');
  }
}

export interface PendingActivity {
  locationId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  authMethod?: 'jwt' | 'api_key';
  apiKeyId?: string;
}

export type ActionHandler = (action: CommandAction, ctx: ActionContext, tx: TxQueryFn) => Promise<ActionResult>;

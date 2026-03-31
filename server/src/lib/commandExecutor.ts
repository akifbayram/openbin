import { withTransaction } from '../db.js';
import { logActivity } from './activityLog.js';
import { handlers } from './commandHandlers/index.js';
import type { ActionContext, PendingActivity } from './commandHandlers/types.js';
import type { CommandAction } from './commandParser.js';

export interface ActionResult {
  type: string;
  success: boolean;
  details: string;
  bin_id?: string;
  bin_name?: string;
  error?: string;
}

export interface ExecuteResult {
  executed: ActionResult[];
  errors: string[];
}

// Re-export for consumers that import PendingActivity from here
export type { PendingActivity };

const MAX_ACTIONS = 50;

export async function executeActions(
  actions: CommandAction[],
  locationId: string,
  userId: string,
  userName: string,
  authMethod?: 'jwt' | 'api_key',
  apiKeyId?: string,
): Promise<ExecuteResult> {
  if (actions.length > MAX_ACTIONS) {
    throw new Error(`Too many actions (${actions.length}). Maximum is ${MAX_ACTIONS}.`);
  }

  const executed: ActionResult[] = [];
  const errors: string[] = [];
  const pendingActivities: PendingActivity[] = [];

  const ctx: ActionContext = { locationId, userId, userName, pendingActivities, authMethod, apiKeyId };

  await withTransaction(async (tx) => {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const handler = handlers[action.type];
      if (!handler) {
        executed.push({
          type: action.type,
          success: false,
          details: 'Unknown action type',
          error: 'Unknown action type',
        });
        continue;
      }

      const savepointName = `action_${i}`;
      try {
        await tx(`SAVEPOINT ${savepointName}`);
        const result = await handler(action, ctx, tx);
        await tx(`RELEASE SAVEPOINT ${savepointName}`);
        executed.push(result);
      } catch (err) {
        await tx(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${action.type}: ${msg}`);
        executed.push({
          type: action.type,
          success: false,
          details: msg,
          error: msg,
        });
      }
    }
  });

  // Fire-and-forget activity log entries after transaction commits
  for (const activity of pendingActivities) {
    logActivity(activity);
  }

  return { executed, errors };
}

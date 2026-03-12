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

export type ActionHandler = (action: CommandAction, ctx: ActionContext) => ActionResult;

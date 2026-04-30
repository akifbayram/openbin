import type { TxQueryFn } from '../db/types.js';

export interface NewUserPayload {
  userId: string;
  email: string | null;
  activeUntil: string;
  status: string;
}

export interface UserUpdatePayload {
  userId: string;
  action: 'update_subscription' | 'delete_user';
  plan?: number;
  status?: number;
  activeUntil?: string | null;
}

export interface DeletionContext {
  userId: string;
  refundPolicy: 'none' | 'prorated';
}

export interface CancellationResult {
  cancelled: boolean;
  hadActiveSubscription: boolean;
  refundAmountCents?: number;
  reason?: string;
}

interface EeHooks {
  onNewUser?: (user: NewUserPayload) => void;
  onUserUpdate?: (payload: UserUpdatePayload) => void;
  onDeleteUser?: (userId: string) => Promise<void>;
  cancelSubscription?: (ctx: DeletionContext) => Promise<CancellationResult>;
  deleteBillingCustomer?: (userId: string) => Promise<void>;
  notifyDeletionScheduled?: (
    userId: string,
    scheduledAt: string,
    hadActiveSubscription: boolean,
    refundAmountCents?: number,
  ) => void;
  onHardDeleteUser?: (tx: TxQueryFn, userId: string) => Promise<void>;
}

const hooks: EeHooks = {};

export function registerEeHooks(h: Partial<EeHooks>): void {
  Object.assign(hooks, h);
}

export function getEeHooks(): Readonly<EeHooks> {
  return hooks;
}

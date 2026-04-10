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

interface EeHooks {
  onNewUser?: (user: NewUserPayload) => void;
  onUserUpdate?: (payload: UserUpdatePayload) => void;
  onDeleteUser?: (userId: string) => Promise<void>;
}

const hooks: EeHooks = {};

export function registerEeHooks(h: Partial<EeHooks>): void {
  Object.assign(hooks, h);
}

export function getEeHooks(): Readonly<EeHooks> {
  return hooks;
}

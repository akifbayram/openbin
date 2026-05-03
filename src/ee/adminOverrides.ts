import { apiFetch } from '@/lib/api';

export interface UserLimitOverrides {
  userId: string;
  maxBins: number | null;
  maxLocations: number | null;
  maxPhotoStorageMb: number | null;
  maxMembersPerLocation: number | null;
  activityRetentionDays: number | null;
  aiCreditsPerMonth: number | null;
  aiEnabled: boolean | null;
}

export async function fetchOverrides(userId: string) {
  return apiFetch<UserLimitOverrides>(`/api/admin/overrides/overrides/${userId}`);
}

export async function updateOverrides(userId: string, overrides: Partial<UserLimitOverrides>) {
  await apiFetch(`/api/admin/overrides/overrides/${userId}`, { method: 'PUT', body: overrides });
}

export async function clearOverrides(userId: string) {
  await apiFetch(`/api/admin/overrides/overrides/${userId}`, { method: 'DELETE' });
}

export async function grantAiCredits(userId: string, amount: number) {
  await apiFetch(`/api/admin/overrides/ai-credits/grant/${userId}`, { method: 'POST', body: { amount } });
}

export async function resetAiCredits(userId: string) {
  await apiFetch(`/api/admin/overrides/ai-credits/reset/${userId}`, { method: 'POST' });
}

export async function extendTrial(userId: string, days: number) {
  return apiFetch<{ message: string; activeUntil: string }>(`/api/admin/overrides/extend-trial/${userId}`, { method: 'POST', body: { days } });
}

export async function grantCompPlan(userId: string, plan: number, days: number) {
  return apiFetch<{ message: string; activeUntil: string }>(`/api/admin/overrides/grant-comp/${userId}`, { method: 'POST', body: { plan, days } });
}

export async function forceDowngrade(userId: string, plan: number) {
  await apiFetch(`/api/admin/overrides/force-downgrade/${userId}`, { method: 'POST', body: { plan } });
}

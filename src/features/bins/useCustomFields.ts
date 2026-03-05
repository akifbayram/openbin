import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, notify } from '@/lib/eventBus';
import { useListData } from '@/lib/useListData';
import type { CustomField } from '@/types';

export const notifyCustomFieldsChanged = () => notify(Events.CUSTOM_FIELDS);

export function useCustomFields(locationId?: string | null) {
  const { token } = useAuth();
  const { data: fields, isLoading } = useListData<CustomField>(
    token && locationId
      ? `/api/locations/${encodeURIComponent(locationId)}/custom-fields`
      : null,
    [Events.CUSTOM_FIELDS],
  );
  return { fields, isLoading };
}

export async function addCustomField(locationId: string, name: string): Promise<CustomField> {
  const result = await apiFetch<CustomField>(
    `/api/locations/${encodeURIComponent(locationId)}/custom-fields`,
    { method: 'POST', body: { name } },
  );
  notifyCustomFieldsChanged();
  return result;
}

export async function updateCustomField(
  locationId: string,
  fieldId: string,
  changes: { name?: string; position?: number },
): Promise<void> {
  await apiFetch(
    `/api/locations/${encodeURIComponent(locationId)}/custom-fields/${encodeURIComponent(fieldId)}`,
    { method: 'PUT', body: changes },
  );
  notifyCustomFieldsChanged();
}

export async function reorderCustomFields(
  locationId: string,
  fieldIds: string[],
): Promise<void> {
  await apiFetch(
    `/api/locations/${encodeURIComponent(locationId)}/custom-fields/reorder`,
    { method: 'PUT', body: { field_ids: fieldIds } },
  );
  notifyCustomFieldsChanged();
}

export async function deleteCustomField(
  locationId: string,
  fieldId: string,
): Promise<void> {
  await apiFetch(
    `/api/locations/${encodeURIComponent(locationId)}/custom-fields/${encodeURIComponent(fieldId)}`,
    { method: 'DELETE' },
  );
  notifyCustomFieldsChanged();
}

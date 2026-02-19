import { useAuth } from './auth';
import { useLocationList } from '@/features/locations/useLocations';

export function usePermissions() {
  const { user, activeLocationId } = useAuth();
  const { locations } = useLocationList();

  const activeLocation = locations.find((l) => l.id === activeLocationId);
  const isAdmin = activeLocation?.role === 'admin';

  return {
    isAdmin,
    canEditBin: (createdBy: string) => isAdmin || createdBy === user?.id,
    canDeleteBin: isAdmin,
    canManageAreas: isAdmin,
    canManageMembers: isAdmin,
  };
}

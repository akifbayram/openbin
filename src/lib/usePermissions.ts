import { useLocationList } from '@/features/locations/useLocations';
import { useAuth } from './auth';

export function usePermissions() {
  const { user, activeLocationId } = useAuth();
  const { locations, isLoading } = useLocationList();

  const activeLocation = locations.find((l) => l.id === activeLocationId);
  const isAdmin = activeLocation?.role === 'admin';

  return {
    isLoading,
    isAdmin,
    canEditBin: (createdBy: string) => isAdmin || createdBy === user?.id,
    canChangeVisibility: (createdBy: string) => createdBy === user?.id,
    canDeleteBin: isAdmin,
    canManageAreas: isAdmin,
    canManageMembers: isAdmin,
  };
}

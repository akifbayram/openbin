import { useLocationList } from '@/features/locations/useLocations';
import { useAuth } from './auth';

export type MemberRole = 'admin' | 'member' | 'viewer';

export function usePermissions() {
  const { user, activeLocationId } = useAuth();
  const { locations, isLoading } = useLocationList();

  const activeLocation = locations.find((l) => l.id === activeLocationId);
  const role: MemberRole | undefined = activeLocation?.role;
  const isAdmin = role === 'admin';
  const isMember = role === 'member';
  const isViewer = role === 'viewer';
  const canWrite = isAdmin || isMember;

  return {
    isLoading,
    role,
    isAdmin,
    isMember,
    isViewer,
    canWrite,
    canEditBin: (createdBy: string) => isAdmin || createdBy === user?.id,
    canEditItems: canWrite,
    canChangeVisibility: (createdBy: string) => createdBy === user?.id,
    canDeleteBin: (createdBy: string) => isAdmin || (isMember && createdBy === user?.id),
    canManageAreas: isAdmin,
    canManageMembers: isAdmin,
    canCreateBin: canWrite,
    canPin: canWrite,
  };
}

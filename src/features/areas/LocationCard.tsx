import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Users, Plus, MapPinned } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/lib/terminology';
import type { Location, Area, Bin } from '@/types';
import { AreaRow } from './AreaRow';
import { LocationSettingsMenu } from './LocationSettingsMenu';

interface LocationCardProps {
  location: Location;
  isActive: boolean;
  areas: Area[];
  bins: Bin[];
  onSetActive: (id: string) => void;
  onMembers: (id: string) => void;
  onRename: (id: string) => void;
  onRetention: (id: string) => void;
  onDelete: (id: string) => void;
  onLeave: (id: string) => void;
  onCreateArea: () => void;
  onRenameArea: (areaId: string, newName: string) => Promise<void>;
  onDeleteArea: (areaId: string, name: string, binCount: number) => void;
}

interface AreaInfo {
  id: string;
  name: string;
  binCount: number;
}

export function LocationCard({
  location,
  isActive,
  areas,
  bins,
  onSetActive,
  onMembers,
  onRename,
  onRetention,
  onDelete,
  onLeave,
  onCreateArea,
  onRenameArea,
  onDeleteArea,
}: LocationCardProps) {
  const t = useTerminology();
  const navigate = useNavigate();
  const isOwner = location.role === 'owner';
  const areaInfos = useMemo(() => {
    const countMap = new Map<string | null, number>();
    for (const bin of bins) {
      countMap.set(bin.area_id, (countMap.get(bin.area_id) || 0) + 1);
    }
    const result: AreaInfo[] = areas.map((a) => ({
      id: a.id,
      name: a.name,
      binCount: countMap.get(a.id) || 0,
    }));
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [areas, bins]);

  const unassignedCount = useMemo(() => {
    return bins.filter((b) => !b.area_id).length;
  }, [bins]);

  function handleAreaClick(areaId: string) {
    navigate('/bins', { state: { areaFilter: areaId } });
  }

  function handleUnassignedClick() {
    navigate('/bins', { state: { areaFilter: '__unassigned__' } });
  }

  // --- Inactive card (compact) ---
  if (!isActive) {
    return (
      <button
        onClick={() => onSetActive(location.id)}
        className={cn(
          'glass-card rounded-[var(--radius-lg)] px-4 py-3.5 text-left w-full',
          'cursor-pointer transition-all duration-200 active:scale-[0.98] hover:bg-[var(--bg-hover)]',
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate block">
              {location.name}
            </span>
          </div>
          <Badge variant="outline" className="text-[11px] shrink-0">
            Set Active
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[13px] text-[var(--text-tertiary)]">
            {isOwner ? (
              <span className="inline-flex items-center gap-1">
                <Crown className="h-3 w-3 inline" />
                Owner
              </span>
            ) : 'Member'}
          </span>
          <span className="text-[13px] text-[var(--text-tertiary)] opacity-50">&middot;</span>
          <span className="text-[13px] text-[var(--text-tertiary)]">
            {location.member_count ?? 0} {(location.member_count ?? 0) !== 1 ? 'members' : 'member'}
          </span>
          <span className="text-[13px] text-[var(--text-tertiary)] opacity-50">&middot;</span>
          <span className="text-[13px] text-[var(--text-tertiary)]">
            {location.area_count ?? 0} {(location.area_count ?? 0) !== 1 ? t.areas : t.area}
          </span>
          <div className="flex-1" />
          {/* Stop propagation on settings/leave buttons so card tap doesn't fire */}
          <span
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
          >
            {isOwner ? (
              <LocationSettingsMenu
                isOwner={isOwner}
                onRename={() => onRename(location.id)}
                onRetention={() => onRetention(location.id)}
                onDelete={() => onDelete(location.id)}
                onLeave={() => onLeave(location.id)}
              />
            ) : (
              <LocationSettingsMenu
                isOwner={false}
                onRename={() => {}}
                onRetention={() => {}}
                onDelete={() => {}}
                onLeave={() => onLeave(location.id)}
              />
            )}
          </span>
        </div>
      </button>
    );
  }

  // --- Active card (expanded) ---
  const memberCount = location.member_count ?? 0;

  return (
    <div
      className={cn(
        'glass-card rounded-[var(--radius-lg)]',
        'outline outline-[1.5px] -outline-offset-[1.5px] outline-[var(--accent)]',
        'flex flex-col relative z-10',
      )}
      style={{ boxShadow: 'var(--shadow-glass), 0 0 12px color-mix(in srgb, var(--accent) 30%, transparent)' }}
    >
      {/* Header band */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-1.5">
        {/* Name row */}
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />
          <span className="text-[17px] font-semibold text-[var(--text-primary)] truncate min-w-0 flex-1">
            {location.name}
          </span>
          <LocationSettingsMenu
            compact
            isOwner={isOwner}
            onRename={() => onRename(location.id)}
            onRetention={() => onRetention(location.id)}
            onDelete={() => onDelete(location.id)}
            onLeave={() => onLeave(location.id)}
          />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 text-[13px] text-[var(--text-tertiary)]">
          {isOwner ? (
            <span className="inline-flex items-center gap-1">
              <Crown className="h-3 w-3" />
              Owner
            </span>
          ) : (
            <span>Member</span>
          )}
          <span className="text-[var(--text-tertiary)] opacity-50">&middot;</span>
          <button
            className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            onClick={() => onMembers(location.id)}
          >
            <Users className="h-3 w-3" />
            {memberCount} {memberCount !== 1 ? 'members' : 'member'}
          </button>
          <div className="flex-1" />
          {isOwner && (
            <Button
              onClick={onCreateArea}
              size="icon"
              className="h-7 w-7 rounded-full"
              aria-label={`Create ${t.area}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Area list */}
      {areaInfos.length === 0 && unassignedCount === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-[var(--text-tertiary)]">
          <MapPinned className="h-10 w-10 opacity-40" />
          <p className="text-[13px]">
            {`No ${t.areas} yet`}
          </p>
          {isOwner && (
            <Button onClick={onCreateArea} variant="outline" size="sm" className="rounded-[var(--radius-full)]">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {`Create ${t.Area}`}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col border-t border-[var(--border-glass)]">
          {areaInfos.map((area) => (
            <AreaRow
              key={area.id}
              id={area.id}
              name={area.name}
              binCount={area.binCount}
              isOwner={isOwner}
              onNavigate={handleAreaClick}
              onRename={onRenameArea}
              onDelete={onDeleteArea}
            />
          ))}
          {unassignedCount > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-hover)] transition-colors">
              <button
                className="flex-1 min-w-0 text-left cursor-pointer"
                onClick={handleUnassignedClick}
              >
                <span className="text-[15px] font-medium text-[var(--text-primary)] truncate block">
                  Unassigned
                </span>
              </button>
              <span className="text-[13px] text-[var(--text-tertiary)] shrink-0 tabular-nums">
                {unassignedCount} {unassignedCount !== 1 ? t.bins : t.bin}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

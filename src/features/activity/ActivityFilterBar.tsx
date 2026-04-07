import { useMemo } from 'react';
import { Disclosure } from '@/components/ui/disclosure';
import { OptionGroup, type OptionGroupOption } from '@/components/ui/option-group';
import { SearchInput } from '@/components/ui/search-input';
import { useLocationMembers } from '@/features/locations/useLocations';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { cn, inputBase } from '@/lib/utils';
import { ENTITY_TYPE_FILTERS, type EntityTypeFilter } from './activityHelpers';

interface ActivityFilterBarProps {
  entityTypeFilter: EntityTypeFilter;
  onEntityTypeChange: (v: EntityTypeFilter) => void;
  userId: string;
  onUserIdChange: (v: string) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
}

export function ActivityFilterBar({
  entityTypeFilter,
  onEntityTypeChange,
  userId,
  onUserIdChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  searchQuery,
  onSearchChange,
}: ActivityFilterBarProps) {
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const { members } = useLocationMembers(activeLocationId);
  const filterOptions = useMemo<OptionGroupOption<EntityTypeFilter>[]>(
    () => ENTITY_TYPE_FILTERS.map((f) => ({ key: f.value, label: f.tKey ? t[f.tKey] : f.label })),
    [t],
  );

  const hasActiveFilters = userId || dateFrom || dateTo;

  const filterControls = (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={userId}
        onChange={(e) => onUserIdChange(e.target.value)}
        aria-label="Filter by user"
        className={cn(inputBase, '!w-auto min-w-[140px] !py-1.5 text-[13px]')}
      >
        <option value="">All users</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.display_name || m.username}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        aria-label="From date"
        className={cn(inputBase, '!w-auto !py-1.5 text-[13px]')}
      />
      <input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        aria-label="To date"
        className={cn(inputBase, '!w-auto !py-1.5 text-[13px]')}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-2 mb-4">
      {/* Search input */}
      <SearchInput
        placeholder="Search activity..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onClear={searchQuery ? () => onSearchChange('') : undefined}
      />

      {/* Entity type pills + filters row */}
      <div className="flex items-start gap-2 flex-wrap">
        <OptionGroup
          options={filterOptions}
          value={entityTypeFilter}
          onChange={onEntityTypeChange}
          size="sm"
          scrollable
          className="shrink-0"
        />

        {/* Desktop: inline filter controls */}
        <div className="hidden lg:flex ml-auto">
          {filterControls}
        </div>
      </div>

      {/* Mobile: collapsible filter controls */}
      <div className="lg:hidden">
        <Disclosure
          label={<span>{hasActiveFilters ? 'Filters (active)' : 'Filters'}</span>}
          indicator={!!hasActiveFilters}
          defaultOpen={!!hasActiveFilters}
        >
          {filterControls}
        </Disclosure>
      </div>
    </div>
  );
}

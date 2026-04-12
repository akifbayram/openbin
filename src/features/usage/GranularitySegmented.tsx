import { OptionGroup } from '@/components/ui/option-group';
import { useUserPreferences } from '@/lib/userPreferences';
import type { UsageGranularity } from '@/types';

const OPTIONS = [
  { key: 'daily' as const, label: 'Day' },
  { key: 'weekly' as const, label: 'Week' },
  { key: 'monthly' as const, label: 'Month' },
];

interface GranularitySegmentedProps {
  /** Optional override — if provided, uses local state; otherwise persists to user prefs. */
  value?: UsageGranularity;
  onChange?: (granularity: UsageGranularity) => void;
}

export function GranularitySegmented({ value, onChange }: GranularitySegmentedProps) {
  const { preferences, updatePreferences } = useUserPreferences();
  const current = value ?? preferences.usage_granularity;

  function handleChange(next: UsageGranularity) {
    if (onChange) {
      onChange(next);
    } else {
      updatePreferences({ usage_granularity: next });
    }
  }

  return (
    <OptionGroup
      options={OPTIONS}
      value={current}
      onChange={handleChange}
      size="sm"
    />
  );
}

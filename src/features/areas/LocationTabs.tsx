import { OptionGroup } from '@/components/ui/option-group';
import type { Location } from '@/types';

interface LocationTabsProps {
  locations: Location[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function LocationTabs({ locations, activeId, onSelect }: LocationTabsProps) {
  const options = locations.map((loc) => ({ key: loc.id, label: loc.name }));
  const scrollable = locations.length >= 5;

  return (
    <OptionGroup
      options={options}
      value={activeId ?? ''}
      onChange={onSelect}
      scrollable={scrollable}
    />
  );
}

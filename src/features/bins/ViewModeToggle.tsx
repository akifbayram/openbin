import { LayoutGrid, Grid3x3, Table2 } from 'lucide-react';
import { OptionGroup, type OptionGroupOption } from '@/components/ui/option-group';
import type { ViewMode } from './useViewMode';

const VIEW_OPTIONS: OptionGroupOption<ViewMode>[] = [
  { key: 'grid', label: 'Grid', icon: LayoutGrid },
  { key: 'compact', label: 'Compact', icon: Grid3x3 },
  { key: 'table', label: 'Table', icon: Table2 },
];

export function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <OptionGroup
      options={VIEW_OPTIONS}
      value={value}
      onChange={onChange}
      iconOnly
      size="sm"
      shape="pill"
    />
  );
}

import { Globe, Lock } from 'lucide-react';
import type { OptionGroupOption } from '@/components/ui/option-group';
import { OptionGroup } from '@/components/ui/option-group';
import type { BinVisibility } from '@/types';

const options: OptionGroupOption<BinVisibility>[] = [
  { key: 'location', label: 'Everyone', icon: Globe },
  { key: 'private', label: 'Only Me', icon: Lock },
];

interface VisibilityPickerProps {
  value: BinVisibility;
  onChange: (value: BinVisibility) => void;
}

export function VisibilityPicker({ value, onChange }: VisibilityPickerProps) {
  return <OptionGroup options={options} value={value} onChange={onChange} />;
}

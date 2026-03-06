import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { ICON_MAP, ICON_NAMES, resolveIcon } from '@/lib/iconMap';
import { cn } from '@/lib/utils';

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const CurrentIcon = resolveIcon(value);
  const displayName = value || 'Package';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px]  hover:bg-gray-500/8 dark:hover:bg-gray-500/18 transition-colors border border-black/6 dark:border-white/6"
      >
        <CurrentIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        <span className="flex-1 text-left">{displayName}</span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500 dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
      </button>
      {open && (
        <div className="grid grid-cols-6 gap-1.5 p-2 rounded-[var(--radius-sm)] border border-black/6 dark:border-white/6 bg-white/70 dark:bg-gray-800/70">
          {ICON_NAMES.map((name) => {
            const Icon = ICON_MAP[name];
            const isSelected = (value || 'Package') === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name === 'Package' ? '' : name);
                  setOpen(false);
                }}
                title={name}
                className={cn(
                  'flex items-center justify-center p-2 rounded-[var(--radius-sm)] transition-colors',
                  isSelected
                    ? 'bg-purple-600 dark:bg-purple-500 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-500/8 dark:hover:bg-gray-500/18'
                )}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

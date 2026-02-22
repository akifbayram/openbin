import { cn } from '@/lib/utils';

export function OptionGroup<K extends string>({
  options,
  value,
  onChange,
  gap = 'gap-1.5',
  renderLabel,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  gap?: string;
  renderLabel?: (opt: { key: K; label: string }) => string;
}) {
  return (
    <div className={cn('flex', gap)}>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            'flex-1 py-1 rounded-full text-[12px] font-medium transition-colors',
            value === opt.key
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
          )}
        >
          {renderLabel ? renderLabel(opt) : opt.label}
        </button>
      ))}
    </div>
  );
}

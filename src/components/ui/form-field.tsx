import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, htmlFor, hint, children, className }: FormFieldProps) {
  const hintId = hint && htmlFor ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] text-[var(--text-secondary)]">
        {label}
      </label>
      {children}
      {hint && <p id={hintId} className="text-[11px] text-[var(--text-tertiary)]">{hint}</p>}
    </div>
  );
}

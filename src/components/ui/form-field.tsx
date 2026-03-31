import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, htmlFor, hint, error, children, className }: FormFieldProps) {
  const hintId = hint && htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] text-[var(--text-secondary)]">
        {label}
      </label>
      {children}
      {error && <p id={errorId} role="alert" className="text-[11px] text-[var(--destructive)]">{error}</p>}
      {hint && !error && <p id={hintId} className="text-[11px] text-[var(--text-tertiary)]">{hint}</p>}
    </div>
  );
}

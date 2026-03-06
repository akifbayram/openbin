import { Field } from '@chakra-ui/react';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, htmlFor, hint, children, className }: FormFieldProps) {
  return (
    <Field.Root className={cn('space-y-1.5', className)}>
      <Field.Label htmlFor={htmlFor} className="text-[13px] text-[var(--text-secondary)]">
        {label}
      </Field.Label>
      {children}
      {hint && <Field.HelperText className="text-[11px] text-[var(--text-tertiary)]">{hint}</Field.HelperText>}
    </Field.Root>
  );
}

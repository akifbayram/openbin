import { Field } from '@chakra-ui/react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, htmlFor, hint, children, className }: FormFieldProps) {
  return (
    <Field.Root display="flex" flexDirection="column" gap="1.5" className={className}>
      <Field.Label
        htmlFor={htmlFor}
        fontSize="13px"
        color="var(--text-medium)"
      >
        {label}
      </Field.Label>
      {children}
      {hint && (
        <Field.HelperText fontSize="11px" color="var(--text-tertiary)">
          {hint}
        </Field.HelperText>
      )}
    </Field.Root>
  );
}

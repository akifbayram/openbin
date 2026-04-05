import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface EditableTextProps {
  value: string;
  placeholder?: string;
  onSave: (value: string) => void;
  multiline?: boolean;
  className?: string;
  readOnly?: boolean;
  saved?: boolean;
  maxLength?: number;
}

export function EditableText({
  value,
  placeholder = '',
  onSave,
  multiline = false,
  className,
  readOnly = false,
  saved = false,
  maxLength,
}: EditableTextProps) {
  const [localValue, setLocalValue] = useState(value);
  const committedRef = useRef(value);

  // Sync from prop when server value changes
  const prevValue = useRef(value);
  if (value !== prevValue.current) {
    prevValue.current = value;
    setLocalValue(value);
    committedRef.current = value;
  }

  function handleBlur() {
    const trimmed = multiline ? localValue : localValue.trim();
    if (trimmed !== committedRef.current) {
      committedRef.current = trimmed;
      onSave(trimmed);
    }
  }

  const textStyles = cn(
    'text-[15px] leading-relaxed text-[var(--text-primary)]',
    className,
  );

  if (readOnly) {
    const hasValue = value.trim().length > 0;
    return multiline ? (
      <p className={cn(textStyles, 'whitespace-pre-wrap', !hasValue && 'text-[var(--text-quaternary)]')}>
        {hasValue ? value : placeholder}
      </p>
    ) : (
      <span className={cn(textStyles, !hasValue && 'text-[var(--text-quaternary)]')}>
        {hasValue ? value : placeholder}
      </span>
    );
  }

  const Tag = multiline ? 'textarea' : 'input';

  return (
    <div className={cn(saved && 'animate-save-flash')}>
      <Tag
        value={localValue}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          setLocalValue(e.target.value);
        }}
        onBlur={handleBlur}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setLocalValue(committedRef.current);
            (e.target as HTMLElement).blur();
          }
          if (!multiline && e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLElement).blur();
          }
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn(
          textStyles,
          'w-full bg-transparent outline-none focus-visible:border-b focus-visible:border-b-[var(--accent)] resize-none placeholder:text-[var(--text-quaternary)]',
          multiline && '[field-sizing:content] min-h-[1.5em]',
        )}
        {...(multiline ? { rows: 1 } : {})}
      />
    </div>
  );
}

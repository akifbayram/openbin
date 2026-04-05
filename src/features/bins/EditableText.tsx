import { Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync local value when prop changes (e.g. after server refetch)
  const prevValue = useRef(value);
  if (value !== prevValue.current) {
    prevValue.current = value;
    if (!editing) setEditValue(value);
  }

  function startEdit() {
    if (readOnly) return;
    setEditValue(value);
    setEditing(true);
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (!multiline && inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
      if (multiline && inputRef.current instanceof HTMLTextAreaElement) {
        const el = inputRef.current;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
        el.selectionStart = el.selectionEnd = el.value.length;
      }
    }
  }, [editing, multiline]);

  function commitEdit() {
    setEditing(false);
    const trimmed = multiline ? editValue : editValue.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
  }

  function cancelEdit() {
    setEditValue(value);
    setEditing(false);
  }

  const textStyles = cn(
    'text-[15px] leading-relaxed text-[var(--text-primary)]',
    className,
  );

  if (editing) {
    const Tag = multiline ? 'textarea' : 'input';
    return (
      <div className={cn('rounded-[var(--radius-sm)] p-1.5 -m-1.5', saved && 'animate-save-flash')}>
        <Tag
          ref={inputRef as React.RefObject<HTMLInputElement & HTMLTextAreaElement>}
          value={editValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setEditValue(e.target.value);
            if (multiline && e.target instanceof HTMLTextAreaElement) {
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }
          }}
          onBlur={commitEdit}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit();
            }
            if (!multiline && e.key === 'Enter') {
              e.preventDefault();
              commitEdit();
            }
          }}
          maxLength={maxLength}
          className={cn(
            textStyles,
            'w-full bg-transparent outline-none resize-none',
            multiline && '[field-sizing:content] min-h-[1.5em]',
          )}
          {...(multiline ? { rows: 1 } : {})}
        />
      </div>
    );
  }

  const hasValue = value.trim().length > 0;

  if (readOnly) {
    return (
      <div className={cn('rounded-[var(--radius-sm)] p-1.5 -m-1.5')}>
        <div className="relative">
          {multiline ? (
            <p className={cn(textStyles, 'whitespace-pre-wrap', !hasValue && 'text-[var(--text-quaternary)]')}>
              {hasValue ? value : placeholder}
            </p>
          ) : (
            <span className={cn(textStyles, !hasValue && 'text-[var(--text-quaternary)]')}>
              {hasValue ? value : placeholder}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'group/editable block w-full text-left rounded-[var(--radius-sm)] p-1.5 -m-1.5 transition-colors duration-150 cursor-text hover:bg-[var(--bg-hover)]',
        saved && 'animate-save-flash',
      )}
      onClick={startEdit}
    >
      <div className="relative">
        {multiline ? (
          <p className={cn(textStyles, 'whitespace-pre-wrap', !hasValue && 'text-[var(--text-quaternary)]')}>
            {hasValue ? value : placeholder}
          </p>
        ) : (
          <span className={cn(textStyles, !hasValue && 'text-[var(--text-quaternary)]')}>
            {hasValue ? value : placeholder}
          </span>
        )}
        <Pencil className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-quaternary)] opacity-0 group-hover/editable:opacity-100 transition-opacity duration-150" />
      </div>
    </button>
  );
}

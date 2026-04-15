import { Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  containerClassName?: string;
  /** Content rendered between the search icon and the input (e.g. filter badges) */
  children?: ReactNode;
  /** Show a clear button and call this when clicked */
  onClear?: () => void;
  /** aria-label for the clear button (default: "Clear search") */
  clearLabel?: string;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ containerClassName, className, children, onClear, clearLabel = 'Clear search', ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-input)] px-3.5 min-h-11 py-1.5 ring-1 ring-inset ring-[var(--border-flat)] transition-all duration-200 focus-within:ring-2 focus-within:ring-[var(--accent)]',
          containerClassName,
        )}
      >
        <Search className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
        {children}
        <input
          ref={ref}
          type="text"
          className={cn(
            'flex-1 min-w-[80px] bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none',
            className,
          )}
          {...props}
        />
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label={clearLabel}
            className="p-2 -mr-1 rounded-[var(--radius-lg)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-active)] shrink-0 flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  },
);
SearchInput.displayName = 'SearchInput';

export { SearchInput };

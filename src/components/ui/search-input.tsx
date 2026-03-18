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
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ containerClassName, className, children, onClear, ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-[var(--radius-full)] bg-[var(--bg-input)] px-3.5 min-h-10 py-1.5 focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:shadow-[0_0_0_4px_var(--accent-glow)] transition-all duration-200',
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
            aria-label="Clear search"
            className="p-2 -mr-1 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-active)] shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
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

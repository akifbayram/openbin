import { forwardRef } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  containerClassName?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ containerClassName, className, ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-[var(--radius-full)] bg-[var(--bg-input)] px-3.5 min-h-10 py-1.5 focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:shadow-[0_0_0_4px_var(--accent-glow)] transition-all duration-200',
          containerClassName,
        )}
      >
        <Search className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
        <input
          ref={ref}
          type="text"
          className={cn(
            'flex-1 min-w-[80px] bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none',
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);

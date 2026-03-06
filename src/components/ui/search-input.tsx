import { Search } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  containerClassName?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ containerClassName, className, ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-[var(--radius-full)] bg-gray-500/12 dark:bg-gray-500/24 px-3.5 min-h-10 py-1.5 focus-within:ring-2 focus-within:ring-purple-600 dark:focus-within:ring-purple-500 focus-within:shadow-[0_0_0_4px] focus-within:shadow-purple-600/15 dark:focus-within:shadow-purple-500/20 transition-all duration-200',
          containerClassName,
        )}
      >
        <Search className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
        <input
          ref={ref}
          type="text"
          className={cn(
            'flex-1 min-w-[80px] bg-transparent text-[15px] placeholder:text-gray-500 dark:placeholder:text-gray-400 outline-none',
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);

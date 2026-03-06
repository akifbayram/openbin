import { Flex } from '@chakra-ui/react';
import { Search } from 'lucide-react';
import { forwardRef } from 'react';

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  containerClassName?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ containerClassName, className, ...props }, ref) => {
    return (
      <Flex
        align="center"
        gap="1.5"
        minW="0"
        borderRadius="var(--radius-full)"
        bg="var(--bg-input)"
        px="3.5"
        minH="10"
        py="1.5"
        className={`focus-within:ring-2 focus-within:ring-purple-600 dark:focus-within:ring-purple-500 focus-within:shadow-[0_0_0_4px] focus-within:shadow-purple-600/15 dark:focus-within:shadow-purple-500/20 transition-all duration-200${containerClassName ? ` ${containerClassName}` : ''}`}
      >
        <Search className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
        <input
          ref={ref}
          type="text"
          style={{
            flex: 1,
            minWidth: '80px',
            background: 'transparent',
            fontSize: '15px',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
          className={`placeholder:text-gray-500 dark:placeholder:text-gray-400${className ? ` ${className}` : ''}`}
          {...props}
        />
      </Flex>
    );
  },
);

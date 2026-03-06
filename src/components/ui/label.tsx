import { Field } from '@chakra-ui/react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => {
    return (
      <Field.Label
        ref={ref}
        className={cn(
          'text-[13px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
          className
        )}
        {...props}
      />
    );
  }
);
Label.displayName = 'Label';

export { Label };

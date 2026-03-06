import { Field } from '@chakra-ui/react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => {
    return (
      <Field.Label
        ref={ref}
        className={cn(
          'text-[13px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider',
          className
        )}
        {...props}
      />
    );
  }
);
Label.displayName = 'Label';

export { Label };

import * as React from 'react';
import { cn } from '@/lib/utils';

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => {
    return (
      // biome-ignore lint/a11y/noLabelWithoutControl: generic base component; consumers provide htmlFor
      <label
        ref={ref}
        className={cn('ui-group-label', className)}
        {...props}
      />
    );
  }
);
Label.displayName = 'Label';

export { Label };

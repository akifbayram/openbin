import * as React from 'react';
import { cn, inputBase } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        autoComplete="off"
        className={cn(
          'flex min-h-0', inputBase,
          'focus-visible:ring-2 focus-visible:ring-[var(--accent)] resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };

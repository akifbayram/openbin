import * as React from 'react';
import { cn, flatCard } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(flatCard, 'transition-all duration-200', className)}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1 px-5 pt-5 pb-1', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-[17px] font-semibold leading-tight text-[var(--text-primary)]', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-[13px] text-[var(--text-tertiary)] leading-snug', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

const cardContentPadding = {
  default: 'px-5 py-4',
  compact: 'py-3 px-4',
  relaxed: 'py-6 px-5',
  none: '',
} as const;

const cardContentSpacing = {
  none: '',
  sm: 'space-y-2',
  md: 'space-y-4',
  lg: 'space-y-5',
} as const;

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof cardContentPadding;
  spacing?: keyof typeof cardContentSpacing;
}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, padding = 'default', spacing = 'none', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardContentPadding[padding], cardContentSpacing[spacing], className)}
      {...props}
    />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center px-5 pb-4 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };

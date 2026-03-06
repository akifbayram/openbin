import * as React from 'react';
import { cn, glassCard } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(glassCard, 'transition-all duration-200', className)}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={className ? cn('flex flex-col space-y-1 px-5 pt-5 pb-1', className) : 'flex flex-col space-y-1 px-5 pt-5 pb-1'} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={className ? cn('text-[17px] font-semibold leading-tight text-[var(--text-primary)]', className) : 'text-[17px] font-semibold leading-tight text-[var(--text-primary)]'}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={className ? cn('text-[13px] text-[var(--text-tertiary)] leading-snug', className) : 'text-[13px] text-[var(--text-tertiary)] leading-snug'} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={className ? cn('px-5 py-4', className) : 'px-5 py-4'} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={className ? cn('flex items-center px-5 pb-4 pt-0', className) : 'flex items-center px-5 pb-4 pt-0'} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };

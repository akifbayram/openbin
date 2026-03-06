import { Badge as ChakraBadge } from '@chakra-ui/react';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const variantMap = {
  default: 'solid' as const,
  secondary: 'subtle' as const,
  destructive: 'solid' as const,
  outline: 'outline' as const,
};

const variantClasses: Record<string, string> = {
  default: 'bg-[var(--accent)] text-[var(--text-on-accent)]',
  secondary: 'bg-[var(--bg-input)] text-[var(--text-secondary)]',
  destructive: 'bg-[var(--destructive)] text-[var(--text-on-accent)]',
  outline: 'border border-[var(--border-glass)] text-[var(--text-secondary)]',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function Badge({ className, variant = 'default', onClick, style, children, ...props }: BadgeProps) {
  const classes = cn(
    'inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-0.5 text-[12px] font-medium transition-colors',
    variantClasses[variant],
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cn(classes, 'border-0 cursor-pointer')}
        onClick={onClick}
        style={style}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }

  return (
    <ChakraBadge
      variant={variantMap[variant]}
      className={classes}
      style={style}
      {...props}
    >
      {children}
    </ChakraBadge>
  );
}

export { Badge };

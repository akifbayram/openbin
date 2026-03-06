import { Badge as ChakraBadge } from '@chakra-ui/react';
import type * as React from 'react';

const badgeVariantStyles: Record<string, React.CSSProperties> = {
  default: { background: 'var(--accent)', color: 'white' },
  secondary: { background: 'var(--bg-input)', color: 'var(--text-medium)' },
  destructive: { background: 'var(--destructive)', color: 'white' },
  outline: { border: '1px solid var(--border-glass)', color: 'var(--text-medium)', background: 'transparent' },
  ghost: { background: 'var(--bg-hover)', color: 'var(--text-medium)' },
};

export interface BadgeProps extends React.HTMLAttributes<HTMLElement> {
  variant?: keyof typeof badgeVariantStyles;
}

function Badge({ className, variant = 'default', onClick, style, ...props }: BadgeProps) {
  const variantStyle = badgeVariantStyles[variant] ?? badgeVariantStyles.default;

  const mergedStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-full)',
    paddingInline: '0.625rem',
    paddingBlock: '0.125rem',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'color 0.15s, background-color 0.15s',
    ...variantStyle,
    ...(onClick ? { border: 0, cursor: 'pointer' } : {}),
    ...style,
  };

  const Comp = onClick ? 'button' : 'div';

  return (
    <ChakraBadge unstyled asChild style={mergedStyle} className={className} onClick={onClick}>
      <Comp {...(onClick ? { type: 'button' } : {})} {...props} />
    </ChakraBadge>
  );
}

export { Badge };

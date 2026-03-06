import { Avatar } from '@chakra-ui/react';
import type React from 'react';

const sizeStyles: Record<string, React.CSSProperties> = {
  xs: { height: '1.25rem', width: '1.25rem', fontSize: '10px' },
  sm: { height: '2rem', width: '2rem', fontSize: '13px' },
  md: { height: '2.25rem', width: '2.25rem', fontSize: '14px' },
  lg: { height: '6rem', width: '6rem', fontSize: '32px' },
};

interface UserAvatarProps {
  avatarUrl?: string | null;
  displayName?: string;
  size?: keyof typeof sizeStyles;
  className?: string;
}

export function UserAvatar({ avatarUrl, displayName, size = 'sm', className }: UserAvatarProps) {
  const initial = displayName?.[0]?.toUpperCase() ?? '?';

  const baseStyle: React.CSSProperties = {
    borderRadius: 'var(--radius-full)',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...(!avatarUrl ? {
      background: 'var(--bg-active)',
      fontWeight: 600,
      color: 'var(--text-medium)',
    } : {}),
    ...sizeStyles[size],
  };

  return (
    <Avatar.Root
      unstyled
      style={baseStyle}
      className={className}
    >
      {avatarUrl ? (
        <Avatar.Image
          src={avatarUrl}
          alt=""
          style={{ height: '100%', width: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Avatar.Fallback name={displayName}>{initial}</Avatar.Fallback>
      )}
    </Avatar.Root>
  );
}

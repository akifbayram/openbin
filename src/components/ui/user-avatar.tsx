import { cn } from '@/lib/utils';

const sizeClasses = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-8 w-8 text-[13px]',
  md: 'h-9 w-9 text-[14px]',
  lg: 'h-24 w-24 text-[32px]',
} as const;

interface UserAvatarProps {
  avatarUrl?: string | null;
  displayName?: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}

export function UserAvatar({ avatarUrl, displayName, size = 'sm', className }: UserAvatarProps) {
  const initial = displayName?.[0]?.toUpperCase() ?? '?';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={cn('rounded-full object-cover shrink-0', sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-[var(--bg-active)] flex items-center justify-center font-semibold text-[var(--text-secondary)] shrink-0',
        sizeClasses[size],
        className,
      )}
    >
      {initial}
    </div>
  );
}

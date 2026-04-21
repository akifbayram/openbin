import { Loader2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn, focusRing } from '@/lib/utils';

interface SettingsProfileHeaderProps {
  avatarUrl: string | null;
  displayName: string;
  email?: string | null;
  /** Small chips shown below the email (calendar/location counts, plan pill, etc.). */
  meta?: ReactNode;
  onAvatarUpload: (file: File) => void;
  onAvatarRemove: () => void;
  uploading?: boolean;
  accept?: string;
}

export function SettingsProfileHeader({
  avatarUrl,
  displayName,
  email,
  meta,
  onAvatarUpload,
  onAvatarRemove,
  uploading,
  accept = 'image/jpeg,image/png,image/webp',
}: SettingsProfileHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-4 py-4 border-b border-[var(--border-subtle)]">
      <div className="relative group shrink-0">
        {avatarUrl && (
          <button
            type="button"
            onClick={onAvatarRemove}
            disabled={uploading}
            className={cn(
              'absolute -top-1 -right-1 z-10 h-8 w-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-flat)] flex items-center justify-center',
              'hover:bg-[var(--destructive)] hover:text-white hover:border-[var(--destructive)]',
              'transition-colors duration-150 disabled:opacity-50 opacity-0 group-hover:opacity-100 max-lg:opacity-100',
              focusRing,
            )}
            aria-label="Remove avatar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'relative cursor-pointer hover:opacity-85 transition-opacity duration-150 disabled:opacity-50 rounded-full',
            focusRing,
          )}
          aria-label="Change avatar"
        >
          <UserAvatar avatarUrl={avatarUrl} displayName={displayName} size="lg" />
          <div
            className={cn(
              'absolute inset-0 rounded-full bg-black/30 flex items-center justify-center transition-opacity duration-200',
              uploading ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
          >
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <p className="settings-entity-title truncate">{displayName}</p>
        {email && <p className="settings-row-desc truncate">{email}</p>}
        {meta && (
          <div className="settings-hint flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
            {meta}
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAvatarUpload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

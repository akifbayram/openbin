import { Users, Settings2, Pencil, Trash2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Location } from '@/types';

interface LocationToolbarProps {
  location: Location;
  isOwner: boolean;
  onMembers: () => void;
  onRetention: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function LocationToolbar({ location, isOwner, onMembers, onRetention, onRename, onDelete }: LocationToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate min-w-0">
        {location.name}
      </span>
      {isOwner && (
        <Badge variant="secondary" className="text-[11px] gap-1 py-0 shrink-0">
          <Crown className="h-3 w-3" />
          Owner
        </Badge>
      )}
      <div className="flex-1" />
      <div className="flex gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-[var(--radius-full)] h-8 px-3"
          onClick={onMembers}
        >
          <Users className="h-3.5 w-3.5 mr-1.5" />
          Members
        </Button>
        {isOwner && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={onRetention}
              aria-label="Data retention settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={onRename}
              aria-label="Rename location"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8 text-[var(--destructive)]"
              onClick={onDelete}
              aria-label="Delete location"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { BulkUpdateDialog } from '@/lib/bulk/BulkUpdateDialog';
import { cn, inputBase } from '@/lib/utils';
import { getParentEligibleTags } from './tagHelpers';
import type { TagEntry } from './useTags';

interface BulkSetParentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTagNames: string[];
  allTags: TagEntry[];
  tagParents: Map<string, string>;
  onApply: (tags: string[], parentTag: string | null) => Promise<void>;
}

export function BulkSetParentDialog({
  open,
  onOpenChange,
  selectedTagNames,
  allTags,
  tagParents,
  onApply,
}: BulkSetParentDialogProps) {
  const [parentValue, setParentValue] = useState('');
  const eligible = useMemo(
    () => getParentEligibleTags(allTags, tagParents, selectedTagNames),
    [allTags, tagParents, selectedTagNames],
  );

  return (
    <BulkUpdateDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setParentValue('');
        onOpenChange(v);
      }}
      title={`Set parent for ${selectedTagNames.length} tag${selectedTagNames.length === 1 ? '' : 's'}`}
      description="Choose a parent tag, or None to clear."
      selectedIds={selectedTagNames}
      onApply={(tags) => onApply(tags, parentValue || null)}
      applyLabel="Save"
      loadingLabel="Saving…"
    >
      <div className="space-y-2">
        <Label htmlFor="bulk-set-parent-select">Parent</Label>
        <select
          id="bulk-set-parent-select"
          value={parentValue}
          onChange={(e) => setParentValue(e.target.value)}
          className={cn(inputBase, 'h-10 focus-visible:ring-2 focus-visible:ring-[var(--accent)]')}
        >
          <option value="">None</option>
          {eligible.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>
    </BulkUpdateDialog>
  );
}

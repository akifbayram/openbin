import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BulkUpdateDialog } from '@/lib/bulk/BulkUpdateDialog';
import { cn, inputBase } from '@/lib/utils';
import type { TagEntry } from './useTags';

interface BulkMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTagNames: string[];
  allTags: TagEntry[];
  binsAffected: number;
  onApply: (fromTags: string[], toTag: string) => Promise<void>;
}

export function BulkMergeDialog({
  open,
  onOpenChange,
  selectedTagNames,
  allTags,
  binsAffected,
  onApply,
}: BulkMergeDialogProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [existingTarget, setExistingTarget] = useState('');
  const [newTarget, setNewTarget] = useState('');

  const candidates = useMemo(() => {
    const sel = new Set(selectedTagNames);
    return allTags.map((t) => t.tag).filter((t) => !sel.has(t));
  }, [allTags, selectedTagNames]);

  const target = mode === 'existing' ? existingTarget : newTarget.trim().toLowerCase();
  const targetValid = target.length > 0 && /^[a-z0-9][a-z0-9-]{0,99}$/.test(target);

  return (
    <BulkUpdateDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setMode('existing');
          setExistingTarget('');
          setNewTarget('');
        }
        onOpenChange(v);
      }}
      title={`Merge ${selectedTagNames.length} tag${selectedTagNames.length === 1 ? '' : 's'}`}
      description={`Merge into a single canonical tag across ~${binsAffected} bin${binsAffected === 1 ? '' : 's'}. The originals will be deleted.`}
      selectedIds={selectedTagNames}
      onApply={(tags) => onApply(tags, target)}
      applyDisabled={!targetValid}
      applyLabel="Merge"
      loadingLabel="Merging…"
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-1">
          <button
            type="button"
            className={cn(
              'flex-1 px-3 py-2 rounded-[var(--radius-sm)] text-[13px]',
              mode === 'existing'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-hover)] text-[var(--text-primary)]',
            )}
            onClick={() => setMode('existing')}
          >
            Use existing
          </button>
          <button
            type="button"
            className={cn(
              'flex-1 px-3 py-2 rounded-[var(--radius-sm)] text-[13px]',
              mode === 'new'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-hover)] text-[var(--text-primary)]',
            )}
            onClick={() => setMode('new')}
          >
            Create new
          </button>
        </div>
        {mode === 'existing' ? (
          <div className="space-y-1">
            <Label htmlFor="bulk-merge-existing">Merge into</Label>
            <select
              id="bulk-merge-existing"
              value={existingTarget}
              onChange={(e) => setExistingTarget(e.target.value)}
              className={cn(inputBase, 'h-10')}
            >
              <option value="">Select a tag…</option>
              {candidates.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="bulk-merge-new">New tag name</Label>
            <Input
              id="bulk-merge-new"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="electronics"
              maxLength={100}
            />
          </div>
        )}
      </div>
    </BulkUpdateDialog>
  );
}

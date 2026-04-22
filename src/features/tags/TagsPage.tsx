import { Folder, GitMerge, PackageOpen, Palette, Plus, Sparkles, Tags as TagsIcon, Trash2 } from 'lucide-react';
import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Crossfade } from '@/components/ui/crossfade';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { useToast } from '@/components/ui/toast';
import { useBinList } from '@/features/bins/useBins';
import { useAuth } from '@/lib/auth';
import { type BulkAction, BulkActionBar } from '@/lib/bulk/BulkActionBar';
import { useBulkSelection } from '@/lib/bulk/useBulkSelection';
import { useTerminology } from '@/lib/terminology';
import { useDebounce } from '@/lib/useDebounce';
import { useMountOnOpen } from '@/lib/useMountOnOpen';
import { usePermissions } from '@/lib/usePermissions';
import { usePlan } from '@/lib/usePlan';
import { useTableSearchParams } from '@/lib/useTableSearchParams';
import { cn, getErrorMessage, inputBase } from '@/lib/utils';
import { sumBinCounts } from './BulkDeleteTagsDialog';
import { CreateTagDialog } from './CreateTagDialog';
import { useTagColorsContext } from './TagColorsContext';
import { type TagSortColumn, TagTableView } from './TagTableView';
import { getParentEligibleTags } from './tagHelpers';
import { useTagBulkActions } from './useTagBulkActions';
import { setTagColor, setTagParent } from './useTagColors';
import { useTagStyle } from './useTagStyle';
import { deleteTag, renameTag, type TagEntry, usePaginatedTagList } from './useTags';

const BulkDeleteTagsDialog = lazy(() =>
  import('./BulkDeleteTagsDialog').then((m) => ({ default: m.BulkDeleteTagsDialog })),
);
const BulkSetParentDialog = lazy(() =>
  import('./BulkSetParentDialog').then((m) => ({ default: m.BulkSetParentDialog })),
);
const BulkSetColorDialog = lazy(() =>
  import('./BulkSetColorDialog').then((m) => ({ default: m.BulkSetColorDialog })),
);
const BulkMergeDialog = lazy(() =>
  import('./BulkMergeDialog').then((m) => ({ default: m.BulkMergeDialog })),
);

export function TagsPage() {
  const navigate = useNavigate();
  const { search, sortColumn, sortDirection, setSearch, setSort } = useTableSearchParams<TagSortColumn>('alpha');
  const debouncedSearch = useDebounce(search, 300);
  const { activeLocationId } = useAuth();
  const t = useTerminology();
  const { canWrite } = usePermissions();
  const { showToast } = useToast();
  const { bins: allBins } = useBinList(undefined, 'name');
  const { isSelfHosted, isGated } = usePlan();
  const { tags, totalCount, isLoading, isLoadingMore, hasMore, loadMore } = usePaginatedTagList(debouncedSearch, sortColumn, sortDirection);
  const { tagColors, tagParents } = useTagColorsContext();
  const getTagBadgeStyle = useTagStyle();

  const { selectedIds, selectable, toggleSelect, clearSelection } = useBulkSelection<TagEntry>({
    items: tags,
    getId: (t) => t.tag,
    resetDeps: [debouncedSearch, sortColumn, sortDirection],
  });
  const { bulkDelete, bulkSetParent, bulkSetColor, bulkMerge, isBusy } = useTagBulkActions(
    activeLocationId,
    clearSelection,
    showToast,
  );

  const [openBulk, setOpenBulk] = useState<'delete' | 'parent' | 'color' | 'merge' | null>(null);
  const deleteMounted = useMountOnOpen(openBulk === 'delete');
  const parentMounted = useMountOnOpen(openBulk === 'parent');
  const colorMounted = useMountOnOpen(openBulk === 'color');
  const mergeMounted = useMountOnOpen(openBulk === 'merge');

  const selectedTagNames = [...selectedIds];
  const binsAffected = sumBinCounts(tags, selectedTagNames);

  const bulkActions: BulkAction[] = [
    { id: 'delete', icon: Trash2, label: 'Delete', onClick: () => setOpenBulk('delete'), group: 'primary', danger: true },
    { id: 'merge', icon: GitMerge, label: 'Merge', onClick: () => setOpenBulk('merge'), group: 'primary' },
    { id: 'parent', icon: Folder, label: 'Set Parent', onClick: () => setOpenBulk('parent'), group: 'more' },
    { id: 'color', icon: Palette, label: 'Set Color', onClick: () => setOpenBulk('color'), group: 'more' },
  ];

  const tagSuggestionGated = !isSelfHosted && isGated('reorganize');
  const showSuggestButton = canWrite && !tagSuggestionGated && allBins.length > 0;

  const suggestButton = (
    <Button variant="outline" size="sm" onClick={() => navigate('/reorganize?mode=tags')}>
      <Sparkles className="h-4 w-4 mr-1.5" />
      Suggest with AI
    </Button>
  );

  // Rename dialog state
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);

  // Set Parent dialog state
  const [parentTarget, setParentTarget] = useState<string | null>(null);
  const [parentValue, setParentValue] = useState('');
  const [parentLoading, setParentLoading] = useState(false);

  // Parent-eligible tags: not themselves children, excluding the target tag
  const parentEligible = useMemo(
    () => getParentEligibleTags(tags, tagParents, parentTarget ? [parentTarget] : []),
    [tags, tagParents, parentTarget],
  );

  function handleColorChange(tag: string, color: string) {
    if (!activeLocationId) return;
    setTagColor(activeLocationId, tag, color);
  }

  function handleRenameOpen(tag: string) {
    setRenameTarget(tag);
    setRenameValue(tag);
    requestAnimationFrame(() => renameInputRef.current?.select());
  }

  async function handleRenameSubmit() {
    if (!activeLocationId || !renameTarget) return;
    const trimmed = renameValue.trim().toLowerCase();
    if (!trimmed || trimmed === renameTarget) {
      setRenameTarget(null);
      return;
    }
    setRenameLoading(true);
    try {
      const { binsUpdated } = await renameTag(activeLocationId, renameTarget, trimmed);
      showToast({ message: `Renamed "${renameTarget}" → "${trimmed}" in ${binsUpdated} ${binsUpdated === 1 ? t.bin : t.bins}` });
      setRenameTarget(null);
    } catch {
      showToast({ message: 'Failed to rename tag', variant: 'error' });
    } finally {
      setRenameLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!activeLocationId || !deleteTarget) return;
    setDeleteLoading(true);
    try {
      const result = await deleteTag(activeLocationId, deleteTarget);
      const orphanMsg = result.orphanedChildren
        ? ` \u2014 ${result.orphanedChildren} child tag${result.orphanedChildren === 1 ? '' : 's'} moved to top level`
        : '';
      showToast({ message: `Removed "${deleteTarget}" from ${result.binsUpdated} ${result.binsUpdated === 1 ? t.bin : t.bins}${orphanMsg}` });
      setDeleteTarget(null);
    } catch {
      showToast({ message: 'Failed to delete tag', variant: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleSetParentOpen(tag: string) {
    setParentTarget(tag);
    setParentValue(tagParents.get(tag) || '');
  }

  async function handleSetParentSubmit() {
    if (!activeLocationId || !parentTarget) return;
    setParentLoading(true);
    try {
      const currentColor = tagColors.get(parentTarget) || '';
      await setTagParent(activeLocationId, parentTarget, parentValue || null, currentColor);
      showToast({ message: parentValue ? `Set parent of "${parentTarget}" to "${parentValue}"` : `Removed parent from "${parentTarget}"` });
      setParentTarget(null);
    } catch (err: unknown) {
      showToast({ message: getErrorMessage(err, 'Failed to set parent'), variant: 'error' });
    } finally {
      setParentLoading(false);
    }
  }

  return (
    <div className="page-content-wide">
      <PageHeader
        title="Tags"
        actions={canWrite ? (
          <div className="flex items-center gap-2">
            {showSuggestButton && suggestButton}
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Tag
            </Button>
          </div>
        ) : undefined}
      />

      {(totalCount > 0 || search) && (
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={search ? () => setSearch('') : undefined}
          placeholder="Search tags..."
        />
      )}

      <Crossfade
        isLoading={isLoading && tags.length === 0}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full rounded-[var(--radius-sm)]" />
            <div className="flat-card rounded-[var(--radius-md)] overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-hover)]">
                <Skeleton className="h-4 w-10 flex-[2]" />
                <Skeleton className="h-4 w-12 ml-auto" />
              </div>
              <SkeletonList count={6} className="gap-0">
                {(i) => (
                  <div className={cn('px-3 py-2.5 flex items-center gap-3', i < 5 && 'border-b border-[var(--border-subtle)]')}>
                    <div className="flex-[2] min-w-0">
                      <Skeleton className={cn('h-6 rounded-[var(--radius-full)]', i % 3 === 0 ? 'w-24' : i % 3 === 1 ? 'w-16' : 'w-20')} />
                    </div>
                    <Skeleton className="h-4 w-14 shrink-0" />
                    <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                    <Skeleton className="h-4 w-4 shrink-0 rounded-[var(--radius-sm)]" />
                  </div>
                )}
              </SkeletonList>
            </div>
          </div>
        }
      >
        {tags.length === 0 ? (
          <EmptyState
            icon={search ? TagsIcon : PackageOpen}
            title={search ? 'No tags match your search' : 'No tags yet'}
            subtitle={search ? 'Try a different search term' : `Tags added to ${t.bins} will appear here`}
            variant={search ? 'search' : undefined}
          >
            {!search && (
              <div className="flex items-center gap-2">
                {canWrite && (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create Tag
                  </Button>
                )}
                {showSuggestButton && suggestButton}
                <Link to="/bins">
                  <Button variant="secondary" size="sm">Browse {t.bins}</Button>
                </Link>
              </div>
            )}
          </EmptyState>
        ) : (
          <div className={cn(selectable && 'pb-16')}>
            <TagTableView
              tags={tags}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSortChange={setSort}
              searchQuery={debouncedSearch}
              tagColors={tagColors}
              tagParents={tagParents}
              getTagBadgeStyle={getTagBadgeStyle}
              onColorChange={handleColorChange}
              onRename={canWrite ? handleRenameOpen : undefined}
              onDelete={canWrite ? (tag) => setDeleteTarget(tag) : undefined}
              onSetParent={canWrite ? handleSetParentOpen : undefined}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              loadMore={loadMore}
              selectable={selectable}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
            />
          </div>
        )}
      </Crossfade>

      {selectable && canWrite && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onClear={clearSelection}
          isBusy={isBusy}
          actions={bulkActions}
          selectionLabel={`${selectedIds.size} tag${selectedIds.size === 1 ? '' : 's'} selected`}
        />
      )}

      {deleteMounted && (
        <Suspense fallback={null}>
          <BulkDeleteTagsDialog
            open={openBulk === 'delete'}
            onOpenChange={(v) => (v ? setOpenBulk('delete') : setOpenBulk(null))}
            tags={selectedTagNames}
            binsAffected={binsAffected}
            onConfirm={() => bulkDelete(selectedTagNames)}
          />
        </Suspense>
      )}
      {parentMounted && (
        <Suspense fallback={null}>
          <BulkSetParentDialog
            open={openBulk === 'parent'}
            onOpenChange={(v) => (v ? setOpenBulk('parent') : setOpenBulk(null))}
            selectedTagNames={selectedTagNames}
            allTags={tags}
            tagParents={tagParents}
            onApply={bulkSetParent}
          />
        </Suspense>
      )}
      {colorMounted && (
        <Suspense fallback={null}>
          <BulkSetColorDialog
            open={openBulk === 'color'}
            onOpenChange={(v) => (v ? setOpenBulk('color') : setOpenBulk(null))}
            selectedTagNames={selectedTagNames}
            onApply={bulkSetColor}
          />
        </Suspense>
      )}
      {mergeMounted && (
        <Suspense fallback={null}>
          <BulkMergeDialog
            open={openBulk === 'merge'}
            onOpenChange={(v) => (v ? setOpenBulk('merge') : setOpenBulk(null))}
            selectedTagNames={selectedTagNames}
            allTags={tags}
            binsAffected={binsAffected}
            onApply={bulkMerge}
          />
        </Suspense>
      )}

      {/* Rename dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename tag</DialogTitle>
            <DialogDescription>
              This will rename &ldquo;{renameTarget}&rdquo; across all {t.bins} in this {t.location}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-tag-input">New name</Label>
            <Input
              ref={renameInputRef}
              id="rename-tag-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); }}
              maxLength={100}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameTarget(null)} disabled={renameLoading}>Cancel</Button>
            <Button onClick={handleRenameSubmit} disabled={renameLoading || !renameValue.trim()}>
              {renameLoading ? 'Renaming…' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tag</DialogTitle>
            <DialogDescription>
              This will remove &ldquo;{deleteTarget}&rdquo; from all {t.bins} in this {t.location}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Parent dialog */}
      <Dialog open={parentTarget !== null} onOpenChange={(open) => { if (!open) setParentTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set parent</DialogTitle>
            <DialogDescription>
              Choose a parent tag for &ldquo;{parentTarget}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="set-parent-select">Parent</Label>
            <select
              id="set-parent-select"
              value={parentValue}
              onChange={(e) => setParentValue(e.target.value)}
              className={cn(inputBase, 'h-10 focus-visible:ring-2 focus-visible:ring-[var(--accent)]')}
            >
              <option value="">None</option>
              {parentEligible.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setParentTarget(null)} disabled={parentLoading}>Cancel</Button>
            <Button onClick={handleSetParentSubmit} disabled={parentLoading}>
              {parentLoading ? 'Saving\u2026' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create tag dialog */}
      <CreateTagDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onConfirm={(createdTag) => {
          setCreateOpen(false);
          if (createdTag) {
            showToast({ message: `Created tag "${createdTag}"` });
          }
        }}
        suggestions={tags.map((t) => t.tag)}
        tagParents={tagParents}
      />
    </div>
  );
}

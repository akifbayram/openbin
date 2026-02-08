import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Pencil, Trash2, Printer, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { QRCodeDisplay } from '@/features/qrcode/QRCodeDisplay';
import { TagInput } from './TagInput';
import { ItemsInput } from './ItemsInput';
import { useBin, updateBin, deleteBin, restoreBin } from './useBins';
import { PhotoGallery } from '@/features/photos/PhotoGallery';
import { getPhotosForBin } from '@/features/photos/usePhotos';
import type { Bin } from '@/types';

export function BinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bin = useBin(id);
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editItems, setEditItems] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (bin === undefined) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-4 pb-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-3/4" />
        <div className="glass-card rounded-[var(--radius-lg)] p-6">
          <Skeleton className="h-40 w-40 mx-auto" />
        </div>
        <div className="glass-card rounded-[var(--radius-lg)] p-4 space-y-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (bin === null || (!bin && id)) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
        <p className="text-[17px] font-semibold text-[var(--text-secondary)]">Bin not found</p>
        <Button variant="outline" onClick={() => navigate('/')} className="rounded-[var(--radius-full)]">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to bins
        </Button>
      </div>
    );
  }

  function startEdit() {
    if (!bin) return;
    setEditName(bin.name);
    setEditItems([...bin.items]);
    setEditNotes(bin.notes);
    setEditTags([...bin.tags]);
    setEditing(true);
  }

  async function saveEdit() {
    if (!id || !editName.trim()) return;
    await updateBin(id, {
      name: editName.trim(),
      items: editItems,
      notes: editNotes.trim(),
      tags: editTags,
    });
    setEditing(false);
  }

  async function handleDelete() {
    if (!id || !bin) return;
    const snapshot: Bin = { ...bin };
    const photoSnapshot = await getPhotosForBin(id);
    await deleteBin(id);
    navigate('/');
    showToast({
      message: `Deleted "${snapshot.name}"`,
      action: {
        label: 'Undo',
        onClick: () => restoreBin(snapshot, photoSnapshot),
      },
    });
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-4 pb-2">
      {/* Top bar */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="rounded-[var(--radius-full)] gap-0.5 pl-1.5 pr-3 text-[var(--accent)]"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-[15px]">Bins</span>
        </Button>
        <div className="flex-1" />
        {!editing && (
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={startEdit}
              aria-label="Edit bin"
              className="rounded-full h-9 w-9"
            >
              <Pencil className="h-[18px] w-[18px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/print?ids=${id}`)}
              aria-label="Print label"
              className="rounded-full h-9 w-9"
            >
              <Printer className="h-[18px] w-[18px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete bin"
              className="rounded-full h-9 w-9 text-[var(--destructive)]"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <Card>
          <CardContent className="space-y-5 py-5">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Items</Label>
              <ItemsInput items={editItems} onChange={setEditItems} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagInput tags={editTags} onChange={setEditTags} />
            </div>
            <div className="flex gap-2.5 justify-end pt-1">
              <Button variant="ghost" onClick={() => setEditing(false)} className="rounded-[var(--radius-full)]">
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={!editName.trim()} className="rounded-[var(--radius-full)]">
                <Save className="h-4 w-4 mr-1.5" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Title */}
          <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight leading-tight">
            {bin.name}
          </h1>

          {/* QR Code */}
          <Card>
            <CardContent className="py-6">
              <div className="flex flex-col items-center">
                <QRCodeDisplay binId={bin.id} />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          {bin.items.length > 0 && (
            <Card>
              <CardContent>
                <Label>Items</Label>
                <ul className="mt-2 space-y-1">
                  {bin.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[15px] text-[var(--text-primary)] leading-relaxed">
                      <span className="text-[var(--text-tertiary)] mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {bin.notes && (
            <Card>
              <CardContent>
                <Label>Notes</Label>
                <p className="mt-2 text-[15px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                  {bin.notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Photos */}
          <PhotoGallery binId={bin.id} />

          {/* Tags */}
          {bin.tags.length > 0 && (
            <Card>
              <CardContent>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {bin.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label>Created</Label>
                  <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
                    {bin.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <Label>Updated</Label>
                  <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
                    {bin.updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this bin?</DialogTitle>
            <DialogDescription>
              This will delete '{bin.name}' and all its photos. You can undo this action briefly after deletion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} className="rounded-[var(--radius-full)]">
              Cancel
            </Button>
            <Button
              onClick={() => {
                setDeleteOpen(false);
                handleDelete();
              }}
              className="rounded-[var(--radius-full)] bg-[var(--destructive)] hover:bg-[var(--destructive-hover)] text-[var(--text-on-accent)]"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

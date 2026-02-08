import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Pencil, Trash2, Printer, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { QRCodeDisplay } from '@/features/qrcode/QRCodeDisplay';
import { TagInput } from './TagInput';
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
  const [editContents, setEditContents] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  if (bin === undefined) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--text-tertiary)]">
        Loading...
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
    setEditContents(bin.contents);
    setEditTags([...bin.tags]);
    setEditing(true);
  }

  async function saveEdit() {
    if (!id || !editName.trim()) return;
    await updateBin(id, {
      name: editName.trim(),
      contents: editContents.trim(),
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
    <div className="flex flex-col gap-4 px-[var(--page-px)] pt-4 pb-2">
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
              onClick={handleDelete}
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
              <Label htmlFor="edit-contents">Contents</Label>
              <Textarea
                id="edit-contents"
                value={editContents}
                onChange={(e) => setEditContents(e.target.value)}
                rows={4}
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

          {/* Contents */}
          {bin.contents && (
            <Card>
              <CardContent>
                <Label>Contents</Label>
                <p className="mt-2 text-[15px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                  {bin.contents}
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
    </div>
  );
}

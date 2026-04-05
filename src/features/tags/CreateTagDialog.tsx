import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { HueGradientPicker } from '@/features/bins/ColorPicker';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getTagTextColor, resolveColor } from '@/lib/colorPalette';
import { Events, notify } from '@/lib/eventBus';
import { useTheme } from '@/lib/theme';
import { cn, inputBase } from '@/lib/utils';

interface CreateTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tagName: string;
  onConfirm: () => void;
  suggestions?: string[];
  tagParents?: Map<string, string>;
  defaultParent?: string | null;
}

export function CreateTagDialog({ open, onOpenChange, tagName, onConfirm, suggestions, tagParents, defaultParent }: CreateTagDialogProps) {
  const { activeLocationId } = useAuth();
  const { theme } = useTheme();
  const [color, setColor] = useState('');
  const [parent, setParent] = useState('');

  useEffect(() => {
    if (open) {
      setColor('');
      setParent(defaultParent || '');
    }
  }, [open, defaultParent]);

  // Parent-eligible: tags that are NOT children of another tag
  const parentOptions = useMemo(() => {
    if (!suggestions || !tagParents) return [];
    return suggestions.filter((t) => !tagParents.has(t) && t !== tagName);
  }, [suggestions, tagParents, tagName]);

  const currentPreset = color ? resolveColor(color) : undefined;
  const previewStyle = currentPreset
    ? { backgroundColor: currentPreset.bgCss, color: getTagTextColor(currentPreset, theme) }
    : undefined;

  function handleConfirm() {
    if (activeLocationId) {
      const effectiveColor = color || '';
      const effectiveParent = parent || null;
      if (effectiveColor || effectiveParent) {
        apiFetch('/api/tag-colors', {
          method: 'PUT',
          body: { locationId: activeLocationId, tag: tagName, color: effectiveColor, parentTag: effectiveParent },
        }).then(() => notify(Events.TAG_COLORS));
      }
    }
    onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create new tag</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Preview</span>
          <Badge variant="secondary" className="text-[13px]" style={previewStyle}>
            {tagName}
          </Badge>
        </div>

        <div className="space-y-2">
          <Label>Color</Label>
          <HueGradientPicker value={color} onChange={setColor} />
        </div>

        {parentOptions.length > 0 && (
          <div className="space-y-2">
            <Label>Parent</Label>
            <select
              value={parent}
              onChange={(e) => setParent(e.target.value)}
              className={cn(inputBase, 'h-10')}
            >
              <option value="">None</option>
              {parentOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {parent && (
              <p className="text-[12px] text-[var(--text-tertiary)]">
                Will be grouped under: <span className="font-medium text-[var(--text-secondary)]">{parent}</span>
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

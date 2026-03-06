import { useEffect, useState } from 'react';
import { Button, Dialog } from '@chakra-ui/react';
import { Label } from '@/components/ui/label';
import { getSecondaryColorInfo, setSecondaryColor } from '@/lib/cardStyle';
import { ColorPicker } from './ColorPicker';
import { IconPicker } from './IconPicker';
import { StylePicker } from './StylePicker';
import { updateBin } from './useBins';

interface BulkAppearanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkAppearanceDialog({ open, onOpenChange, binIds, onDone }: BulkAppearanceDialogProps) {
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [cardStyle, setCardStyle] = useState('');
  const [iconDirty, setIconDirty] = useState(false);
  const [colorDirty, setColorDirty] = useState(false);
  const [styleDirty, setStyleDirty] = useState(false);
  const [loading, setLoading] = useState(false);

  const anyDirty = iconDirty || colorDirty || styleDirty;

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIcon('');
      setColor('');
      setCardStyle('');
      setIconDirty(false);
      setColorDirty(false);
      setStyleDirty(false);
    }
  }, [open]);

  async function handleApply() {
    const changes: Record<string, string> = {};
    if (iconDirty) changes.icon = icon;
    if (colorDirty) changes.color = color;
    if (styleDirty) changes.cardStyle = cardStyle;
    setLoading(true);
    try {
      await Promise.all(binIds.map((id) => updateBin(id, changes)));
      onOpenChange(false);
      onDone();
    } finally {
      setLoading(false);
    }
  }

  const sec = getSecondaryColorInfo(cardStyle);

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Appearance</Dialog.Title>
            <Dialog.Description>
              Customize {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''}. Only modified sections will be applied.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Icon
                  {iconDirty && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                </Label>
                <IconPicker value={icon} onChange={(v) => { setIcon(v); setIconDirty(true); }} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Color
                  {colorDirty && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                </Label>
                <ColorPicker
                  value={color}
                  onChange={(v) => { setColor(v); setColorDirty(true); }}
                  secondaryLabel={sec?.label}
                  secondaryValue={sec?.value}
                  onSecondaryChange={sec ? (c) => {
                    setCardStyle(setSecondaryColor(cardStyle, c));
                    setColorDirty(true);
                    setStyleDirty(true);
                  } : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Style
                  {styleDirty && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                </Label>
                <StylePicker value={cardStyle} color={color} onChange={(v) => { setCardStyle(v); setStyleDirty(true); }} photos={[]} />
              </div>
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={loading || !anyDirty}>
              {loading ? 'Applying...' : 'Apply'}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

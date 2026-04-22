import { useState } from 'react';
import { BulkUpdateDialog } from '@/lib/bulk/BulkUpdateDialog';
import { TagColorPicker } from './TagColorPicker';

interface BulkSetColorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTagNames: string[];
  onApply: (tags: string[], color: string) => Promise<void>;
}

export function BulkSetColorDialog({ open, onOpenChange, selectedTagNames, onApply }: BulkSetColorDialogProps) {
  const [color, setColor] = useState<string>('');

  return (
    <BulkUpdateDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setColor('');
        onOpenChange(v);
      }}
      title={`Set color for ${selectedTagNames.length} tag${selectedTagNames.length === 1 ? '' : 's'}`}
      description="Pick a color to apply to every selected tag."
      selectedIds={selectedTagNames}
      onApply={(tags) => onApply(tags, color)}
      applyDisabled={!color}
      applyLabel="Apply color"
      loadingLabel="Applying…"
    >
      <TagColorPicker
        currentColor={color}
        onColorChange={setColor}
        tagName={`${selectedTagNames.length} tags`}
        inline
      />
    </BulkUpdateDialog>
  );
}

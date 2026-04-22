import { ArrowRightLeft, Clipboard, ClipboardPaste, Copy, Eye, List, MapPin, Paintbrush, Pin, Printer, Shuffle, Sparkles, Tag, Trash2 } from 'lucide-react';
import type { BulkAction } from '@/lib/bulk/BulkActionBar';

export interface BuildBinBulkActionsArgs {
  isAdmin: boolean;
  pinLabel: string;
  aiEnabled?: boolean;
  aiGated?: boolean;
  canCopyStyle: boolean;
  canPasteStyle: boolean;
  showPrint?: boolean;
  showReorganize?: boolean;
  onTag: () => void;
  onMove: () => void;
  onDelete: () => void;
  onAppearance: () => void;
  onVisibility: () => void;
  onMoveLocation: () => void;
  onPin: () => void;
  onDuplicate: () => void;
  onCustomFields?: () => void;
  onCopyStyle?: () => void;
  onPasteStyle?: () => void;
  onAskAi?: () => void;
  onReorganize?: () => void;
  onPrint?: () => void;
}

export function buildBinBulkActions(args: BuildBinBulkActionsArgs): BulkAction[] {
  const showStyleDivider = Boolean(args.canCopyStyle || args.canPasteStyle);
  return [
    { id: 'tag', icon: Tag, label: 'Tag', onClick: args.onTag, group: 'primary', show: args.isAdmin },
    { id: 'move', icon: MapPin, label: 'Move', onClick: args.onMove, group: 'primary', show: args.isAdmin },
    { id: 'print', icon: Printer, label: 'Print', onClick: args.onPrint ?? (() => {}), group: 'primary', show: Boolean(args.showPrint && args.onPrint) },
    { id: 'delete', icon: Trash2, label: 'Delete', onClick: args.onDelete, group: 'primary', show: args.isAdmin, danger: true },
    { id: 'ai', icon: Sparkles, label: 'AI', onClick: args.onAskAi ?? (() => {}), group: 'primary', show: Boolean((args.aiEnabled || args.aiGated) && args.onAskAi) },
    { id: 'appearance', icon: Paintbrush, label: 'Appearance', onClick: args.onAppearance, group: 'more', show: args.isAdmin },
    { id: 'visibility', icon: Eye, label: 'Change Visibility', onClick: args.onVisibility, group: 'more', show: args.isAdmin },
    { id: 'moveLocation', icon: ArrowRightLeft, label: 'Move to Location', onClick: args.onMoveLocation, group: 'more', show: args.isAdmin },
    { id: 'pin', icon: Pin, label: args.pinLabel, onClick: args.onPin, group: 'more', show: args.isAdmin },
    { id: 'duplicate', icon: Copy, label: 'Duplicate', onClick: args.onDuplicate, group: 'more', show: args.isAdmin },
    { id: 'reorganize', icon: Shuffle, label: 'Reorganize', onClick: args.onReorganize ?? (() => {}), group: 'more', show: Boolean(args.aiEnabled && args.showReorganize && args.onReorganize) },
    { id: 'customFields', icon: List, label: 'Custom Fields', onClick: args.onCustomFields ?? (() => {}), group: 'more', show: Boolean(args.isAdmin && args.onCustomFields) },
    { id: 'copyStyle', icon: Clipboard, label: 'Copy Style', onClick: args.onCopyStyle ?? (() => {}), group: 'more', show: Boolean(args.canCopyStyle && args.onCopyStyle), dividerBefore: showStyleDivider },
    { id: 'pasteStyle', icon: ClipboardPaste, label: 'Paste Style', onClick: args.onPasteStyle ?? (() => {}), group: 'more', show: Boolean(args.canPasteStyle && args.onPasteStyle), dividerBefore: showStyleDivider && !args.canCopyStyle },
  ];
}

import type { CellBleed } from './labelFormats';

interface BleedLayerProps {
  bleed: CellBleed;
  color: string;
}

export function BleedLayer({ bleed, color }: BleedLayerProps) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: `-${bleed.top}in`,
        right: `-${bleed.right}in`,
        bottom: `-${bleed.bottom}in`,
        left: `-${bleed.left}in`,
        backgroundColor: color,
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
        zIndex: 0,
      }}
    />
  );
}

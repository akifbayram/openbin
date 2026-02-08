import type { Bin } from '@/types';

interface LabelCellProps {
  bin: Bin;
  qrDataUrl: string;
}

export function LabelCell({ bin, qrDataUrl }: LabelCellProps) {
  return (
    <div className="label-cell flex items-center gap-[4pt] overflow-hidden">
      {qrDataUrl && (
        <img src={qrDataUrl} alt="" className="label-qr shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="label-name font-semibold truncate">{bin.name}</div>
        {bin.items.length > 0 && (
          <div className="label-contents text-gray-600 line-clamp-2">{bin.items.join(', ')}</div>
        )}
      </div>
    </div>
  );
}

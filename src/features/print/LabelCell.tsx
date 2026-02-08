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
        {bin.contents && (
          <div className="label-contents text-gray-600 line-clamp-2">{bin.contents}</div>
        )}
      </div>
    </div>
  );
}

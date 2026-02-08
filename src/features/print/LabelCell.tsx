import type { Bin } from '@/types';
import { resolveIcon } from '@/lib/iconMap';

interface LabelCellProps {
  bin: Bin;
  qrDataUrl: string;
}

export function LabelCell({ bin, qrDataUrl }: LabelCellProps) {
  const Icon = resolveIcon(bin.icon);

  return (
    <div className="label-cell flex items-center gap-[4pt] overflow-hidden">
      {qrDataUrl && (
        <img src={qrDataUrl} alt="" className="label-qr shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="label-name font-semibold truncate flex items-center gap-[2pt]">
          <Icon className="h-[8pt] w-[8pt] shrink-0" />
          <span>{bin.name}</span>
        </div>
        {bin.location && (
          <div className="label-contents text-gray-600 line-clamp-2">{bin.location}</div>
        )}
      </div>
    </div>
  );
}

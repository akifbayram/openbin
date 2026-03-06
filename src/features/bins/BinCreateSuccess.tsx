import { ChevronRight, CirclePlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AnimatedCheckmark } from '@/components/ui/animated-checkmark';
import { Button } from '@chakra-ui/react';
import { ListItem } from '@/components/ui/list-item';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { useTerminology } from '@/lib/terminology';
import { plural } from '@/lib/utils';

export interface CreatedBinInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  itemCount?: number;
}

interface BinCreateSuccessProps {
  createdBins: CreatedBinInfo[];
  onCreateAnother: () => void;
  onClose: () => void;
}

function StatsLine({ createdBins, binsLabel }: { createdBins: CreatedBinInfo[]; binsLabel: string }) {
  const count = createdBins.length;
  const totalItems = createdBins.reduce((sum, b) => sum + (b.itemCount ?? 0), 0);

  if (count === 1) {
    const bin = createdBins[0];
    if (totalItems > 0) {
      return <>Created {bin.name} with {totalItems} {plural(totalItems, 'item')}</>;
    }
    return <>Created {bin.name}</>;
  }

  if (totalItems > 0) {
    return <>Created {count} {binsLabel} &middot; {totalItems} {plural(totalItems, 'item')}</>;
  }
  return <>Created {count} {binsLabel}</>;
}

export function BinCreateSuccess({ createdBins, onCreateAnother, onClose }: BinCreateSuccessProps) {
  const t = useTerminology();
  const navigate = useNavigate();
  const showColor = createdBins.length > 1;

  function handleViewBin(binId: string) {
    onClose();
    navigate(`/bin/${binId}`, { state: { backLabel: t.Bins, backPath: '/bins' } });
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Animated checkmark */}
      <div className="relative flex items-center justify-center">
        <AnimatedCheckmark />
      </div>

      {/* Heading + stats */}
      <div className="text-center scan-text-fade">
        <h2 className="text-xl font-bold ">Success</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          <StatsLine createdBins={createdBins} binsLabel={t.bins} />
        </p>
      </div>

      {/* Bin list */}
      <div className="w-full scan-text-fade-delay">
        <div className={createdBins.length > 1 ? 'flex flex-col gap-2 overflow-y-auto' : undefined} style={createdBins.length > 1 ? { maxHeight: 200 } : undefined}>
          {createdBins.map((bin) => (
            <BinRow key={bin.id} bin={bin} showColor={showColor} onViewBin={handleViewBin} />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex w-full flex-col gap-2 scan-text-fade-delay">
        <Button width="full" onClick={onCreateAnother}>
          <CirclePlus className="mr-2 h-4 w-4" />
          Create another
        </Button>
        <Button
          variant="ghost"
          width="full"
          onClick={onClose}
        >
          Done
        </Button>
      </div>
    </div>
  );
}

export function BinRow({ bin, showColor, onViewBin }: { bin: CreatedBinInfo; showColor: boolean; onViewBin: (id: string) => void }) {
  const Icon = resolveIcon(bin.icon);
  const colorPreset = showColor ? resolveColor(bin.color) : null;

  return (
    <ListItem
      interactive
      onClick={() => onViewBin(bin.id)}
      style={colorPreset ? { background: colorPreset.bgCss, boxShadow: 'none' } : { boxShadow: 'none' }}
    >
      <Icon className="h-5 w-5 shrink-0 text-gray-600 dark:text-gray-300" />
      <span className="flex-1 truncate  font-medium">{bin.name}</span>
      {showColor && (bin.itemCount ?? 0) > 0 && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {bin.itemCount} {plural(bin.itemCount ?? 0, 'item')}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
    </ListItem>
  );
}

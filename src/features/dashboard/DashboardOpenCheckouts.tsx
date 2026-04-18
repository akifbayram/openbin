import { PackageSearch, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BinIconBadge } from '@/components/ui/bin-icon-badge';
import { Tooltip } from '@/components/ui/tooltip';
import { ReturnItemDialog } from '@/features/checkouts/ReturnItemDialog';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { usePermissions } from '@/lib/usePermissions';
import { cn, flatCard, relativeTime } from '@/lib/utils';
import type { ItemCheckoutWithContext } from '@/types';
import { SectionHeader } from './DashboardWidgets';

const VISIBLE_LIMIT = 3;

interface DashboardOpenCheckoutsProps {
  checkouts: ItemCheckoutWithContext[];
  showTimestamps?: boolean;
}

export function DashboardOpenCheckouts({ checkouts, showTimestamps = true }: DashboardOpenCheckoutsProps) {
  const navigate = useNavigate();
  const { canWrite } = usePermissions();
  const [returning, setReturning] = useState<ItemCheckoutWithContext | null>(null);

  if (checkouts.length === 0) return null;

  const rows = checkouts.slice(0, VISIBLE_LIMIT);
  const overflow = checkouts.length - rows.length;

  return (
    <section aria-labelledby="dash-checkouts" className="flex flex-col gap-2">
      <SectionHeader
        id="dash-checkouts"
        icon={PackageSearch}
        title={`Checked out (${checkouts.length})`}
        action={overflow > 0 ? { label: 'View all', onClick: () => navigate('/checkouts') } : undefined}
      />
      <div className={cn(flatCard, 'p-2')}>
        <ul className="flex flex-col">
          {rows.map((co) => {
            const Icon = resolveIcon(co.origin_bin_icon);
            const colorPreset = resolveColor(co.origin_bin_color);
            return (
              <li key={co.id}>
                {/* biome-ignore lint/a11y/useSemanticElements: row contains a nested Return button; native <button> nesting is invalid */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${co.item_name} checked out by ${co.checked_out_by_name} from ${co.origin_bin_name}`}
                  onClick={() => navigate(`/bin/${co.origin_bin_id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/bin/${co.origin_bin_id}`);
                    }
                  }}
                  className="group w-full flex items-center gap-3 px-2.5 py-2 min-h-[52px] rounded-[var(--radius-sm)] cursor-pointer outline-none transition-colors duration-150 hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <BinIconBadge icon={Icon} colorPreset={colorPreset} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium text-[var(--text-primary)] truncate leading-snug">
                      {co.item_name}
                    </p>
                    <p className="text-[11.5px] text-[var(--text-tertiary)] truncate leading-snug">
                      <span className="text-[var(--text-secondary)]">{co.checked_out_by_name}</span>
                      <span aria-hidden> · </span>
                      {co.origin_bin_name}
                    </p>
                  </div>
                  {showTimestamps && (
                    <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums shrink-0">
                      {relativeTime(co.checked_out_at)}
                    </span>
                  )}
                  {canWrite && (
                    <Tooltip content="Return item">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setReturning(co); }}
                        aria-label={`Return ${co.item_name}`}
                        className="shrink-0 h-9 w-9 -my-1 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      >
                        <Undo2 className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {returning && (
        <ReturnItemDialog
          open
          onOpenChange={(next) => { if (!next) setReturning(null); }}
          itemName={returning.item_name}
          binId={returning.origin_bin_id}
          itemId={returning.item_id}
          originBinName={returning.origin_bin_name}
        />
      )}
    </section>
  );
}

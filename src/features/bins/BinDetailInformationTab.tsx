import { useEffect, useMemo, useState } from 'react';
import { useScanHistory } from '@/features/dashboard/scanHistory';
import { BinUsageSection } from '@/features/usage/BinUsageSection';
import { resolveColor } from '@/lib/colorPalette';
import { formatTimeAgo } from '@/lib/formatTime';
import { resolveIcon } from '@/lib/iconMap';
import { generateQRDataURL } from '@/lib/qr';
import { sectionHeader } from '@/lib/utils';
import type { Bin, ItemCheckout } from '@/types';

interface BinDetailInformationTabProps {
  bin: Bin;
  checkouts?: ItemCheckout[];
}

const SECTION_HEAD = 'flex items-baseline justify-between mb-4';

const QR_FG = '#000';
const QR_BG_FALLBACK = '#fff';
// Render QR at a high resolution and let CSS downscale; keeps dots crisp and
// makes the library's integer-rounding leftover (proportional margin) negligible.
const QR_GEN_SIZE = 540;

export function BinDetailInformationTab({ bin, checkouts }: BinDetailInformationTabProps) {
  const openCheckouts = (checkouts ?? []).filter((c) => !c.returned_at);

  const Icon = resolveIcon(bin.icon);
  const colorPreset = useMemo(
    () => (bin.color ? resolveColor(bin.color) : null),
    [bin.color],
  );
  const cardBg = colorPreset?.bg ?? QR_BG_FALLBACK;
  const [qrUrl, setQrUrl] = useState('');
  const { history } = useScanHistory(50);
  const lastScan = useMemo(
    () => history.find((entry) => entry.binId === bin.id),
    [history, bin.id],
  );

  useEffect(() => {
    let cancelled = false;
    generateQRDataURL(bin.id, QR_GEN_SIZE, { dark: QR_FG, light: cardBg }).then((url) => {
      if (!cancelled) setQrUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [bin.id, cardBg]);

  const createdAbsolute = useMemo(
    () =>
      new Date(bin.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [bin.created_at],
  );

  return (
    <div className="flex flex-col gap-8">
      <section>
        <header className={SECTION_HEAD}>
          <h3 className={sectionHeader}>Usage</h3>
        </header>
        <BinUsageSection binId={bin.id} />
      </section>

      <section>
        <header className={SECTION_HEAD}>
          <h3 className={sectionHeader}>Details</h3>
        </header>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 items-start md:gap-8">
          <div
            className="p-[5px] md:p-[7px]"
            style={{
              backgroundColor: cardBg,
              borderRadius: 'var(--radius-lg)',
              border: colorPreset ? 'none' : '1px solid var(--border-flat)',
            }}
          >
            <div className="relative w-[128px] h-[128px] md:w-[180px] md:h-[180px]">
              {qrUrl && (
                <img
                  src={qrUrl}
                  alt={`QR code for ${bin.name}`}
                  className="w-full h-full block"
                />
              )}
              {bin.icon && (
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                  style={{
                    width: '30%',
                    height: '30%',
                    backgroundColor: cardBg,
                    padding: '4px',
                  }}
                >
                  <Icon
                    style={{ width: '100%', height: '100%', color: QR_FG }}
                    strokeWidth={2.5}
                  />
                </div>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2.5 text-[13px] self-start">
            {bin.created_by_name && (
              <>
                <dt className="text-[var(--text-tertiary)]">Creator</dt>
                <dd className="text-[var(--text-primary)]">{bin.created_by_name}</dd>
              </>
            )}

            <dt className="text-[var(--text-tertiary)]">Created</dt>
            <dd className="text-[var(--text-primary)]">{createdAbsolute}</dd>

            <dt className="text-[var(--text-tertiary)]">Updated</dt>
            <dd className="text-[var(--text-primary)]">{formatTimeAgo(bin.updated_at)}</dd>

            <dt className="text-[var(--text-tertiary)]">Last scanned</dt>
            <dd className="text-[var(--text-primary)]">
              {lastScan ? formatTimeAgo(lastScan.scannedAt) : 'Never'}
            </dd>
          </dl>
        </div>
      </section>

      {openCheckouts.length > 0 && (
        <section>
          <header className={SECTION_HEAD}>
            <h3 className={sectionHeader}>Checked out</h3>
            <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums">
              {openCheckouts.length}
            </span>
          </header>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {openCheckouts.map((c) => (
              <li
                key={c.id}
                className="flex justify-between items-baseline py-2 text-[13px]"
              >
                <span className="text-[var(--text-primary)]">{c.checked_out_by_name}</span>
                <span className="text-[var(--text-tertiary)] tabular-nums">
                  {formatTimeAgo(c.checked_out_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useScanHistory } from '@/features/dashboard/scanHistory';
import { CARD_PAD_RATIO, MONO_CODE_WIDTH_EMS } from '@/features/print/pdfConstants';
import { BinUsageSection } from '@/features/usage/BinUsageSection';
import { resolveColor } from '@/lib/colorPalette';
import { formatTimeAgo } from '@/lib/formatTime';
import { resolveIcon } from '@/lib/iconMap';
import { generateQRDataURL } from '@/lib/qr';
import { cn } from '@/lib/utils';
import type { Bin, ItemCheckout } from '@/types';

interface BinDetailInformationTabProps {
  bin: Bin;
  checkouts?: ItemCheckout[];
}

const SECTION_HEADER =
  'text-[12px] font-medium text-[var(--text-tertiary)] mb-3';

// QR codes are spec'd pure black on the lightest surface; kept here so the
// on-screen card stays bit-for-bit identical to the printed label.
const QR_FG = '#000';
const QR_BG_FALLBACK = '#fff';
const QR_SIZE = 220;
const QR_CARD_PAD_PX = Math.round(QR_SIZE * CARD_PAD_RATIO);
const QR_CODE_FONT_PX = QR_SIZE / MONO_CODE_WIDTH_EMS;

export function BinDetailInformationTab({ bin, checkouts }: BinDetailInformationTabProps) {
  const openCheckouts = useMemo(
    () => (checkouts ?? []).filter((c) => !c.returned_at),
    [checkouts],
  );

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
    generateQRDataURL(bin.id, QR_SIZE, { dark: QR_FG, light: cardBg }).then((url) => {
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
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8 md:items-start">
        <div
          className="flex flex-col items-center gap-3 self-start"
          style={{
            backgroundColor: cardBg,
            padding: `${QR_CARD_PAD_PX}px`,
            borderRadius: 'var(--radius-lg)',
            border: colorPreset ? 'none' : '1px solid var(--border-flat)',
          }}
        >
          <div className="relative" style={{ width: QR_SIZE, height: QR_SIZE }}>
            {qrUrl && (
              <img
                src={qrUrl}
                alt="QR code"
                width={QR_SIZE}
                height={QR_SIZE}
                style={{ display: 'block' }}
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
          <div
            className="font-mono font-bold leading-none text-center"
            style={{
              width: QR_SIZE,
              fontSize: `${QR_CODE_FONT_PX}px`,
              letterSpacing: '0.2em',
              textIndent: '0.2em',
              color: QR_FG,
            }}
          >
            {bin.short_code}
          </div>
        </div>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2.5 text-[13px] md:pt-1 self-start">
          <dt className="text-[var(--text-tertiary)]">Created</dt>
          <dd className="text-[var(--text-primary)]">
            {bin.created_by_name ? (
              <>
                {bin.created_by_name}
                <span className="text-[var(--text-tertiary)]"> · {createdAbsolute}</span>
              </>
            ) : (
              createdAbsolute
            )}
          </dd>

          <dt className="text-[var(--text-tertiary)]">Updated</dt>
          <dd className="text-[var(--text-primary)]">{formatTimeAgo(bin.updated_at)}</dd>

          <dt className="text-[var(--text-tertiary)]">Last scanned by you</dt>
          <dd
            className={cn(
              lastScan ? 'text-[var(--text-primary)]' : 'text-[var(--text-quaternary)]',
            )}
          >
            {lastScan ? formatTimeAgo(lastScan.scannedAt) : 'Never'}
          </dd>
        </dl>
      </div>

      <section>
        <h3 className={SECTION_HEADER}>Usage</h3>
        <BinUsageSection binId={bin.id} />
      </section>

      {openCheckouts.length > 0 && (
        <section>
          <h3 className={SECTION_HEADER}>
            Checked out ({openCheckouts.length})
          </h3>
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

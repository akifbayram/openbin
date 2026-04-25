import type { ReactNode } from 'react';

interface PhotoScanFrameProps {
  /** Number of items currently parsed from the streaming AI response. Drives the readout text. */
  itemCount: number;
  /** The photo (or photo grid) being scanned. */
  children: ReactNode;
}

/**
 * HUD-style overlay rendered while the AI analyzes a photo.
 *
 * Four glowing corner brackets bracket the photo, a 2px purple scan line
 * sweeps top→bottom, and a tiny monospaced readout at the bottom switches
 * from `SCANNING` to `FOUND N` as items stream in. Static brackets remain
 * when `prefers-reduced-motion: reduce` is set; the line and blink stop.
 */
export function PhotoScanFrame({ itemCount, children }: PhotoScanFrameProps) {
  const readout = itemCount > 0 ? `FOUND ${itemCount}` : 'SCANNING';

  return (
    <div data-photo-scan-frame className="relative">
      {children}

      {/* Corner brackets */}
      <Bracket position="tl" />
      <Bracket position="tr" />
      <Bracket position="bl" />
      <Bracket position="br" />

      {/* Sweeping scan line */}
      <span
        aria-hidden="true"
        className="ai-scan-line pointer-events-none absolute left-0 right-0 h-[2px]"
        style={{
          background: '#c4a8ff',
          boxShadow: '0 0 8px 1px #b08bff, 0 0 16px 2px rgba(94,47,224,0.7)',
        }}
      />

      {/* Mono readout */}
      <span
        aria-hidden="true"
        className="ai-scan-readout pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9px] font-medium uppercase"
        style={{
          letterSpacing: '0.2em',
          color: '#c4a8ff',
          textShadow: '0 0 6px rgba(94,47,224,0.8)',
        }}
      >
        {readout}
      </span>
    </div>
  );
}

function Bracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const styles: Record<typeof position, React.CSSProperties> = {
    tl: { top: 6, left: 6, borderRight: 'none', borderBottom: 'none' },
    tr: { top: 6, right: 6, borderLeft: 'none', borderBottom: 'none' },
    bl: { bottom: 6, left: 6, borderRight: 'none', borderTop: 'none' },
    br: { bottom: 6, right: 6, borderLeft: 'none', borderTop: 'none' },
  };
  return (
    <span
      data-bracket
      aria-hidden="true"
      className="pointer-events-none absolute h-[18px] w-[18px]"
      style={{
        border: '1.5px solid var(--ai-accent)',
        filter: 'drop-shadow(0 0 4px rgba(94,47,224,0.6))',
        ...styles[position],
      }}
    />
  );
}

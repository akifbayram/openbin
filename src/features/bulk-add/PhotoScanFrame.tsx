type Phase = 'scanning' | 'locking';

interface PhotoScanFrameProps {
  /** Number of items currently parsed from the streaming AI response. Drives the readout text. */
  itemCount: number;
  /** Active phase. 'scanning' (default) animates the sweep + FOUND readout; 'locking' converges the brackets and crossfades the readout to "LOCKED". */
  phase?: Phase;
}

/**
 * HUD-style overlay rendered while the AI analyzes a photo.
 *
 * Four glowing corner brackets, a 2px purple scan line sweeping top→bottom,
 * and a tiny monospaced readout switching from `SCANNING` to `FOUND N` as
 * items stream in.
 *
 * When `phase="locking"`, brackets converge inward via a CSS keyframe and a
 * second readout (`LOCKED`) crossfades over the original. The host component
 * controls how long the locking phase lasts; this component is purely visual.
 *
 * Renders as a fragment of absolutely-positioned chrome — place inside a
 * `position: relative` parent that holds the photo so the photo stays mounted
 * across analyze/review state transitions.
 *
 * Static brackets remain when `prefers-reduced-motion: reduce` is set; line,
 * blink, and lock keyframes stop.
 */
export function PhotoScanFrame({ itemCount, phase = 'scanning' }: PhotoScanFrameProps) {
  const readout = itemCount > 0 ? `FOUND ${itemCount}` : 'SCANNING';
  const isLocking = phase === 'locking';

  return (
    <>
      <Bracket position="tl" phase={phase} />
      <Bracket position="tr" phase={phase} />
      <Bracket position="bl" phase={phase} />
      <Bracket position="br" phase={phase} />

      <span
        aria-hidden="true"
        data-phase={phase}
        className="ai-scan-line pointer-events-none absolute left-0 right-0 h-[2px]"
        style={{
          background: '#c4a8ff',
          boxShadow: '0 0 8px 1px #b08bff, 0 0 16px 2px rgba(94,47,224,0.7)',
        }}
      />

      <span
        aria-hidden="true"
        className={`ai-scan-readout pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9px] font-medium uppercase ${
          isLocking ? 'ai-scan-readout-fade-out' : ''
        }`}
        style={{
          letterSpacing: '0.2em',
          color: '#c4a8ff',
          textShadow: '0 0 6px rgba(94,47,224,0.8)',
        }}
      >
        {readout}
      </span>

      {/* Mounted only while locking — fades in over the FOUND N readout for the crossfade. */}
      {isLocking && (
        <span
          aria-hidden="true"
          className="ai-scan-readout-locked pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9px] font-medium uppercase"
          style={{
            letterSpacing: '0.2em',
            color: '#c4a8ff',
            textShadow: '0 0 6px rgba(94,47,224,0.8)',
          }}
        >
          LOCKED
        </span>
      )}
    </>
  );
}

function Bracket({ position, phase }: { position: 'tl' | 'tr' | 'bl' | 'br'; phase: Phase }) {
  const styles: Record<typeof position, React.CSSProperties> = {
    tl: { top: 6, left: 6, borderRight: 'none', borderBottom: 'none' },
    tr: { top: 6, right: 6, borderLeft: 'none', borderBottom: 'none' },
    bl: { bottom: 6, left: 6, borderRight: 'none', borderTop: 'none' },
    br: { bottom: 6, right: 6, borderLeft: 'none', borderTop: 'none' },
  };
  return (
    <span
      data-bracket={position}
      data-phase={phase}
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

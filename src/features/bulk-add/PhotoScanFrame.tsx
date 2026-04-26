type Phase = 'scanning' | 'locking';

interface PhotoScanFrameProps {
  /** Active phase. 'scanning' (default) sweeps the scan line; 'locking' converges the brackets. */
  phase?: Phase;
}

/**
 * HUD-style overlay rendered while the AI analyzes a photo.
 *
 * Four glowing corner brackets and a 2px purple scan line sweeping top→bottom.
 *
 * When `phase="locking"`, brackets converge inward via a CSS keyframe. The
 * host component controls how long the locking phase lasts; this component
 * is purely visual.
 *
 * Renders as a fragment of absolutely-positioned chrome — place inside a
 * `position: relative` parent that holds the photo so the photo stays mounted
 * across analyze/review state transitions.
 *
 * Static brackets remain when `prefers-reduced-motion: reduce` is set; line
 * and lock keyframes stop.
 */
export function PhotoScanFrame({ phase = 'scanning' }: PhotoScanFrameProps) {
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

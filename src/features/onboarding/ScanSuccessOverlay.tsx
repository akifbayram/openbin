import './animations.css';
import { useEffect } from 'react';

interface ScanSuccessOverlayProps {
  onDismiss: () => void;
  title?: string;
  subtitle?: string;
}

export function ScanSuccessOverlay({ onDismiss, title = 'First scan complete!', subtitle = "You're all set" }: ScanSuccessOverlayProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2800);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[var(--overlay-backdrop)] backdrop-blur-md scan-success-enter"
      onClick={onDismiss}
    >
      {/* Expanding rings */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-24 w-24 rounded-full border-2 border-[var(--accent)] scan-ring scan-ring-1" />
        <div className="absolute h-24 w-24 rounded-full border-2 border-[var(--accent)] scan-ring scan-ring-2" />
        <div className="absolute h-24 w-24 rounded-full border-2 border-[var(--accent)] scan-ring scan-ring-3" />

        {/* Checkmark circle */}
        <div className="relative h-24 w-24 rounded-full bg-[var(--accent)] flex items-center justify-center scan-check-scale">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-12 w-12 scan-check-draw"
          >
            <polyline points="4 12 10 18 20 6" />
          </svg>
        </div>
      </div>

      {/* Text */}
      <p className="mt-8 text-[22px] font-bold text-[var(--text-primary)] scan-text-fade">
        {title}
      </p>
      <p className="mt-2 text-[14px] text-[var(--text-tertiary)] scan-text-fade-delay">
        {subtitle}
      </p>
    </div>
  );
}

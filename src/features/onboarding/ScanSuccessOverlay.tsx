import { useEffect } from 'react';
import { AnimatedCheckmark } from '@/components/ui/animated-checkmark';

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
    // biome-ignore lint/a11y/noStaticElementInteractions: overlay dismisses on click
    <div
      role="presentation"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[var(--overlay-backdrop)] backdrop-blur-md scan-success-enter"
      onClick={onDismiss}
    >
      {/* Expanding rings */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-24 w-24 rounded-full border-2 border-purple-600 dark:border-purple-500 scan-ring scan-ring-1" />
        <div className="absolute h-24 w-24 rounded-full border-2 border-purple-600 dark:border-purple-500 scan-ring scan-ring-2" />
        <div className="absolute h-24 w-24 rounded-full border-2 border-purple-600 dark:border-purple-500 scan-ring scan-ring-3" />

        {/* Checkmark circle */}
        <div className="relative">
          <AnimatedCheckmark size="lg" />
        </div>
      </div>

      {/* Text */}
      <p className="mt-8 text-[22px] font-bold scan-text-fade">
        {title}
      </p>
      <p className="mt-2 text-[14px] text-gray-500 dark:text-gray-400 scan-text-fade-delay">
        {subtitle}
      </p>
    </div>
  );
}

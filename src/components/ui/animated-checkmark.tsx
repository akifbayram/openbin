import { cn } from '@/lib/utils';
import './animations.css';

export function AnimatedCheckmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const circle = size === 'lg' ? 'h-24 w-24' : 'h-20 w-20';
  const icon = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';

  return (
    <div className={cn(circle, 'rounded-full bg-[var(--accent)] flex items-center justify-center scan-check-scale')}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(icon, 'scan-check-draw')}
      >
        <polyline points="4 12 10 18 20 6" />
      </svg>
    </div>
  );
}

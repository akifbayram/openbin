import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import demoBinPhoto from '@/assets/premade-backgrounds/demo_bin.jpg';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DEMO_BIN } from '../onboardingConstants';

export function DemoAiShowcase({ onNext }: { onNext: () => void }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [photoCollapsed, setPhotoCollapsed] = useState(false);

  useEffect(() => {
    // Collapse photo just before items start appearing
    const collapseTimeout = setTimeout(() => setPhotoCollapsed(true), 2500);
    let interval: ReturnType<typeof setInterval> | undefined;
    const startTimeout = setTimeout(() => {
      interval = setInterval(() => {
        setVisibleCount((c) => {
          if (c >= DEMO_BIN.items.length) {
            clearInterval(interval);
            return c;
          }
          return c + 1;
        });
      }, 300);
    }, 3000);
    return () => {
      clearTimeout(collapseTimeout);
      clearTimeout(startTimeout);
      if (interval !== undefined) clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="h-16 w-16 rounded-full flex items-center justify-center mb-5 bg-[var(--accent)]/10">
        <Sparkles className="h-8 w-8 text-[var(--accent)]" />
      </div>
      <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
        Photo to inventory
      </h2>
      <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
        Take a photo of any bin and AI identifies every item inside.
      </p>
      {/* Demo photo */}
      <div className={cn(
        'w-full rounded-[var(--radius-md)] overflow-hidden transition-all duration-500 ease-in-out',
        photoCollapsed ? 'max-h-0 opacity-0 mb-0' : 'ai-photo-shimmer max-h-40 opacity-100 mb-4'
      )}>
        <img src={demoBinPhoto} alt="Bin contents" className="w-full h-40 object-cover" />
      </div>
      {/* Revealed items */}
      {visibleCount > 0 && (
        <div className="w-full rounded-[var(--radius-md)] bg-[var(--bg-input)] overflow-hidden mb-5">
          {DEMO_BIN.items.slice(0, visibleCount).map((item, i) => (
            <div key={item} className="ai-item-reveal" style={{ animationDelay: `${i * 0.05}s` }}>
              <div>
                {i > 0 && <div className="h-px mx-3.5 bg-[var(--border-subtle)]" />}
                <div className="px-3.5 py-1">
                  <span className="text-[15px] text-[var(--text-primary)] leading-relaxed">
                    {item}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        onClick={onNext}
        className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
      >
        See the Result
      </Button>
    </div>
  );
}

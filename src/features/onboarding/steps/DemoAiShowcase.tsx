import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import demoBinPhoto from '@/assets/premade-backgrounds/demo_bin.jpg';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DEMO_BIN } from '../onboardingConstants';

export function DemoAiShowcase({ onNext }: { onNext: () => void }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [photoState, setPhotoState] = useState<'hidden' | 'scanning' | 'collapsed'>('hidden');
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    // Staged reveal: text enters first (step animation), then photo slides in
    const revealTimeout = setTimeout(() => setPhotoState('scanning'), 300);
    // Collapse photo before items start appearing
    const collapseTimeout = setTimeout(() => setPhotoState('collapsed'), 3200);
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
    }, 3700);
    // Show button after all items have finished their reveal animations
    // Last item delay: (items.length - 1) * 0.05s = 0.3s, animation: 0.35s → ~650ms after last item added
    const buttonTimeout = setTimeout(() => setShowButton(true), 3700 + DEMO_BIN.items.length * 300 + 650);
    return () => {
      clearTimeout(buttonTimeout);
      clearTimeout(revealTimeout);
      clearTimeout(collapseTimeout);
      clearTimeout(startTimeout);
      if (interval !== undefined) clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="h-16 w-16 rounded-[var(--radius-xl)] flex items-center justify-center mb-5 bg-[var(--accent)]/10">
        <Sparkles className="h-8 w-8 text-[var(--accent)]" />
      </div>
      <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
        Photo to inventory
      </h2>
      <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
        Take a photo of any bin and AI identifies the items inside.
      </p>
      {/* Demo photo — starts hidden, reveals with transition, then collapses */}
      <div className={cn(
        'w-full rounded-[var(--radius-md)] overflow-hidden transition-all ease-in-out',
        photoState === 'scanning'
          ? 'ai-photo-shimmer ai-photo-shimmer-fast max-h-40 opacity-100 mb-4 duration-1000'
          : 'max-h-0 opacity-0 mb-0 duration-500'
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
      {showButton && (
        <Button
          type="button"
          onClick={onNext}
          className="w-full rounded-[var(--radius-md)] h-11 text-[15px] onboarding-step-enter"
        >
          See the Result
        </Button>
      )}
    </div>
  );
}

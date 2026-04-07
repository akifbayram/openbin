import { Check, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import demoBinPhoto from '@/assets/premade-backgrounds/demo_bin.jpg';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AI_FEATURES, DEMO_BIN } from '../onboardingConstants';

/** Compact labels for the 2×2 feature grid. */
const FEATURE_LABELS = ['Photo AI', 'Commands', 'AI Search', 'Smart Lists'] as const;

/** Number of demo items to reveal before collapsing. */
const VISIBLE_ITEM_COUNT = 5;

export function CloudAiShowcaseStep({ onNext }: { onNext: () => void }) {
  const [photoState, setPhotoState] = useState<'hidden' | 'scanning' | 'collapsed'>('hidden');
  const [visibleCount, setVisibleCount] = useState(0);
  const [phase, setPhase] = useState<'items' | 'summary' | 'features'>('items');

  useEffect(() => {
    // Photo: hidden → scanning → collapsed
    const showPhoto = setTimeout(() => setPhotoState('scanning'), 300);
    const collapsePhoto = setTimeout(() => setPhotoState('collapsed'), 3200);

    // Items reveal one-by-one starting at 3700ms
    let interval: ReturnType<typeof setInterval> | undefined;
    const startItems = setTimeout(() => {
      interval = setInterval(() => {
        setVisibleCount((c) => {
          if (c >= VISIBLE_ITEM_COUNT) {
            clearInterval(interval);
            return c;
          }
          return c + 1;
        });
      }, 300);
    }, 3700);

    // Collapse items into summary at ~5200ms
    const showSummary = setTimeout(() => setPhase('summary'), 3700 + VISIBLE_ITEM_COUNT * 300 + 200);

    // Show feature grid at ~5700ms
    const showFeatures = setTimeout(() => setPhase('features'), 3700 + VISIBLE_ITEM_COUNT * 300 + 700);

    return () => {
      clearTimeout(showPhoto);
      clearTimeout(collapsePhoto);
      clearTimeout(startItems);
      clearTimeout(showSummary);
      clearTimeout(showFeatures);
      if (interval !== undefined) clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="h-14 w-14 rounded-[var(--radius-xl)] flex items-center justify-center mb-4 bg-[var(--accent)]/10">
        <Sparkles className="h-7 w-7 text-[var(--accent)]" />
      </div>
      <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-1.5">
        AI-powered inventory
      </h2>
      <p className="text-[14px] text-[var(--text-tertiary)] mb-4 leading-relaxed">
        Snap a photo and AI catalogs everything inside. Included in your plan.
      </p>

      {/* Demo photo — shimmer scan then collapse */}
      <div className={cn(
        'w-full rounded-[var(--radius-md)] overflow-hidden transition-all ease-in-out',
        photoState === 'scanning'
          ? 'ai-photo-shimmer ai-photo-shimmer-fast max-h-40 opacity-100 mb-3 duration-1000'
          : 'max-h-0 opacity-0 mb-0 duration-500',
      )}>
        <img src={demoBinPhoto} alt="Bin contents" className="w-full h-40 object-cover" />
      </div>

      {/* Phase: items revealing */}
      {phase === 'items' && visibleCount > 0 && (
        <div className="w-full rounded-[var(--radius-md)] bg-[var(--bg-input)] overflow-hidden mb-3">
          {DEMO_BIN.items.slice(0, visibleCount).map((item, i) => (
            <div key={item}>
              {i > 0 && <div className="h-px mx-3.5 bg-[var(--border-subtle)]" />}
              <div className="px-3.5 py-1">
                <span className="text-[14px] text-[var(--text-primary)] leading-relaxed">{item}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Phase: collapsed summary */}
      {phase !== 'items' && (
        <div className="w-full flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--bg-input)] px-3.5 py-2.5 mb-3 onboarding-step-enter">
          <Check className="h-4 w-4 text-green-500 shrink-0" />
          <span className="text-[14px] font-medium text-[var(--text-primary)]">
            {DEMO_BIN.items.length} items identified from photo
          </span>
        </div>
      )}

      {/* Phase: feature grid */}
      {phase === 'features' && (
        <>
          <div className="w-full grid grid-cols-2 gap-2 mb-5">
            {AI_FEATURES.map(({ icon: Icon }, i) => (
              <div
                key={FEATURE_LABELS[i]}
                className="onboarding-feature-card flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--bg-active)] px-2.5 py-2.5"
              >
                <div className="h-7 w-7 rounded-[var(--radius-lg)] flex items-center justify-center shrink-0 bg-[var(--accent)]/10">
                  <Icon className="h-3.5 w-3.5 text-[var(--accent)]" />
                </div>
                <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                  {FEATURE_LABELS[i]}
                </span>
              </div>
            ))}
          </div>
          <Button
            type="button"
            onClick={onNext}
            className="w-full rounded-[var(--radius-md)] h-11 text-[15px] onboarding-step-enter"
          >
            Continue
          </Button>
        </>
      )}
    </div>
  );
}

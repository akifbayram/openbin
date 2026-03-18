import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AI_FEATURES } from '../onboardingConstants';

export function AiShowcaseStep({ onSetUpNow, onSkip }: { onSetUpNow: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="h-16 w-16 rounded-full flex items-center justify-center mb-5 bg-[var(--accent)]/10">
        <Sparkles className="h-8 w-8 text-[var(--accent)]" />
      </div>
      <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
        Add AI superpowers
      </h2>
      <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
        Connect your own API key from OpenAI, Anthropic, or Google to unlock these features.
      </p>
      <div className="w-full space-y-2 mb-6">
        {AI_FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="onboarding-feature-card flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 bg-[var(--bg-active)] text-left">
            <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-[var(--accent)]/10">
              <Icon className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</div>
              <div className="text-[12px] text-[var(--text-tertiary)] leading-snug">{desc}</div>
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        onClick={onSetUpNow}
        className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
      >
        Set Up Now
      </Button>
      <button
        type="button"
        onClick={onSkip}
        className="mt-3 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
      >
        Maybe Later
      </button>
    </div>
  );
}

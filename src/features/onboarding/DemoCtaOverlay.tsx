import '@/components/ui/animations.css';
import { Cloud, Server, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { BrandIcon } from '@/components/BrandIcon';
import { Button } from '@/components/ui/button';
import { useOverlayAnimation } from '@/lib/useOverlayAnimation';
import { closeButton, cn, focusRing, overlayBackdrop } from '@/lib/utils';
import { DEMO_TOUR_DONE_EVENT, getDemoTourDoneAt } from './onboardingConstants';

const DEMO_CTA_DELAY_MS = 3 * 60 * 1000;
const LS_KEY_DISMISSED = 'openbin-demo-cta-dismissed';

const CTA_ACTIONS = [
  { icon: Cloud, label: 'Sign up for Cloud', description: 'Managed hosting, automatic updates', url: 'https://cloud.openbin.app/register' },
  { icon: Server, label: 'Self-host with Docker', description: 'Free, open source, full control', url: 'https://github.com/akifbayram/openbin' },
] as const;

export function DemoCtaOverlay() {
  const [open, setOpen] = useState(false);

  const dismiss = useCallback(() => {
    localStorage.setItem(LS_KEY_DISMISSED, '1');
    setOpen(false);
  }, []);

  const { visible } = useOverlayAnimation({ open, onClose: dismiss });

  useEffect(() => {
    if (localStorage.getItem(LS_KEY_DISMISSED)) return;

    let cleanupRef: (() => void) | undefined;

    function schedule() {
      const doneAt = getDemoTourDoneAt();
      if (!doneAt) return false;
      cleanupRef?.();
      const remaining = Math.max(0, DEMO_CTA_DELAY_MS - (Date.now() - doneAt));
      const timer = setTimeout(() => setOpen(true), remaining);
      cleanupRef = () => clearTimeout(timer);
      return true;
    }

    if (schedule()) return () => cleanupRef?.();

    window.addEventListener(DEMO_TOUR_DONE_EVENT, schedule, { once: true });
    return () => {
      window.removeEventListener(DEMO_TOUR_DONE_EVENT, schedule);
      cleanupRef?.();
    };
  }, []);

  if (!visible) return null;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: dismiss is also reachable via Escape (useOverlayAnimation) and the explicit close button
    <div
      className={cn(overlayBackdrop, 'z-50 flex items-center justify-center', open ? 'opacity-100' : 'opacity-0')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-cta-title"
      onClick={dismiss}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: card swallows backdrop clicks so only the backdrop dismisses */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only — no keyboard equivalent needed */}
      <div
        className="flat-heavy rounded-[var(--radius-xl)] w-full max-w-sm mx-5 px-8 py-8 relative onboarding-step-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className={cn(closeButton, focusRing)}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="onboarding-completion-icon">
            <BrandIcon className="h-16 w-16 text-[var(--accent)] mb-5" />
          </div>
          <h2 id="demo-cta-title" className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
            Ready to get started?
          </h2>
          <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
            Take OpenBin home with you.
          </p>

          <div className="w-full space-y-2 mb-6">
            {CTA_ACTIONS.map(({ icon: Icon, label, description, url }, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'onboarding-action-card w-full flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 bg-[var(--bg-active)] hover:bg-[var(--bg-hover)] transition-colors text-left',
                  focusRing,
                )}
                style={{ animationDelay: `${0.1 + i * 0.07}s` }}
              >
                <div className="h-8 w-8 rounded-[var(--radius-xl)] flex items-center justify-center shrink-0 bg-[var(--accent)]/10">
                  <Icon className="h-4 w-4 text-[var(--accent)]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[14px] font-medium text-[var(--text-primary)]">{label}</span>
                  <p className="text-[12px] text-[var(--text-tertiary)] leading-snug">{description}</p>
                </div>
              </a>
            ))}
          </div>

          <Button
            type="button"
            onClick={dismiss}
            className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
          >
            Continue Exploring
          </Button>
        </div>
      </div>
    </div>
  );
}

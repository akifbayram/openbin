import '@/components/ui/animations.css';
import { Camera, MessageCircle, PackagePlus, Printer, QrCode, Settings, Sparkles, X } from 'lucide-react';
import { useEffect } from 'react';
import { BrandIcon } from '@/components/BrandIcon';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { getCommandInputRef } from '@/features/tour/TourProvider';
import { closeButton, cn, focusRing } from '@/lib/utils';
import type { OnboardingActions } from './onboardingConstants';
import { markDemoTourDone } from './onboardingConstants';
import type { CompletionAction } from './steps/CompletionStep';
import { CompletionStep } from './steps/CompletionStep';
import { CreateBinStep } from './steps/CreateBinStep';
import { DemoAiShowcase } from './steps/DemoAiShowcase';
import { DemoBrowseStep } from './steps/DemoBrowseStep';
import { DemoWelcomeStep } from './steps/DemoWelcomeStep';
import { WelcomeStep } from './steps/WelcomeStep';
import { useOnboardingActions } from './useOnboardingActions';

const DEMO_COMPLETION_ACTIONS: CompletionAction[] = [
  { icon: PackagePlus, label: 'Browse all bins', description: 'Explore the 40+ pre-built demo bins', path: '/bins' },
  { icon: Printer, label: 'Print labels', description: 'Generate QR labels for your bins', path: '/print' },
  { icon: QrCode, label: 'Scan a QR code', description: 'Try scanning a label with your camera', path: '/scan' },
  { icon: Settings, label: 'Explore settings', description: 'Customize terminology, AI, and more', path: '/settings' },
];

function buildProdCompletionActions(newBinId: string | null): CompletionAction[] {
  const printPath = newBinId ? `/print?ids=${newBinId}` : '/print';
  const binPath = newBinId ? `/bins/${newBinId}` : '/bins';
  return [
    { icon: Printer, label: 'Print a QR label', description: 'For the bin you just created', path: printPath },
    { icon: Camera, label: 'Add a photo', description: "Let AI detect what's inside", path: binPath },
    {
      icon: MessageCircle,
      label: 'Try Ask AI',
      description: 'Find your stuff by asking a question',
      onSelect: () => getCommandInputRef().current?.open(),
    },
  ];
}

export function OnboardingOverlay(props: OnboardingActions) {
  const { step, totalSteps, locationId, advanceWithLocation, advanceStep, complete, demoMode, activeLocationId } = props;
  const state = useOnboardingActions(props);
  const { displayedStep, transitioning, loading, navigate } = state;
  const dots = Array.from({ length: totalSteps });

  function handleAction(action: CompletionAction) {
    if (demoMode) markDemoTourDone();
    complete();
    if ('path' in action) navigate(action.path);
    else action.onSelect();
  }

  function handleDashboard() {
    if (demoMode) markDemoTourDone();
    complete();
    navigate('/');
  }

  useEffect(() => {
    if (!demoMode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) state.handleSkipSetup();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [demoMode, loading, state.handleSkipSetup]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismisses demo only; Escape provides keyboard equivalent
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard equivalent handled via document-level Escape listener above
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-backdrop)]"
      onClick={demoMode && !loading ? state.handleSkipSetup : undefined}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: card swallows backdrop clicks so only the backdrop dismisses */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only — no keyboard equivalent needed */}
      <div
        className="flat-heavy rounded-[var(--radius-xl)] w-full max-w-sm mx-5 px-8 py-8 relative max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={state.handleSkipSetup}
          disabled={loading}
          aria-label="Close setup"
          className={cn(closeButton, focusRing, 'disabled:opacity-40')}
        >
          <X className="h-4 w-4" />
        </button>
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {dots.map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static progress dots
            <div key={i}
              className={cn(
                'h-2 w-2 rounded-full transition-all duration-300',
                i <= step ? 'bg-[var(--accent)]' : 'bg-[var(--bg-active)]',
                i === step
                  ? 'scale-125'
                  : i < step
                    ? 'opacity-40'
                    : ''
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <AnimatedHeight className="overflow-y-auto scrollbar-hide min-h-0 -mx-2 px-2">
          <div
            key={displayedStep}
            className={cn(
              'onboarding-step-enter',
              transitioning && 'onboarding-step-exit',
            )}
          >
          {displayedStep === 0 && demoMode && activeLocationId && (
            <DemoWelcomeStep activeLocationId={activeLocationId} onAdvance={advanceWithLocation} />
          )}
          {displayedStep === 0 && !demoMode && (
            <WelcomeStep
              locationName={state.locationName} setLocationName={state.setLocationName}
              handleCreateLocation={state.handleCreateLocation} loading={loading} t={state.t}
            />
          )}
          {displayedStep === 1 && demoMode && (
            <DemoAiShowcase onNext={advanceStep} />
          )}
          {displayedStep === 1 && !demoMode && locationId && (
            <CreateBinStep
              locationId={locationId} binName={state.binName} setBinName={state.setBinName}
              binItems={state.binItems} setBinItems={state.setBinItems}
              handleCreateBin={state.handleCreateBin} loading={loading} t={state.t}
            />
          )}
          {displayedStep === 2 && demoMode && (
            <DemoBrowseStep onNext={advanceStep} />
          )}
          {displayedStep === 2 && !demoMode && (
            <CompletionStep
              icon={<div className="h-16 w-16 rounded-[var(--radius-xl)] flex items-center justify-center mb-5 bg-[var(--accent)]/10"><Sparkles className="h-8 w-8 text-[var(--accent)]" /></div>}
              actions={buildProdCompletionActions(state.newBinId)}
              onAction={handleAction}
              onDashboard={handleDashboard}
            />
          )}
          {displayedStep === 3 && demoMode && (
            <CompletionStep
              icon={<BrandIcon className="h-16 w-16 text-[var(--accent)] mb-5" />}
              title="Tour complete"
              subtitle="That's the essentials. Dive in and explore."
              actions={DEMO_COMPLETION_ACTIONS}
              onAction={handleAction}
              onDashboard={handleDashboard}
            />
          )}
          </div>
        </AnimatedHeight>

      </div>
    </div>
  );
}

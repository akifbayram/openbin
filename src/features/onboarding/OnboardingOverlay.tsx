import '@/components/ui/animations.css';
import { PackagePlus, Printer, QrCode, Settings, Sparkles, X } from 'lucide-react';
import { BrandIcon } from '@/components/BrandIcon';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { cn } from '@/lib/utils';
import type { OnboardingActions } from './onboardingConstants';
import { AiShowcaseStep } from './steps/AiShowcaseStep';
import type { CompletionAction } from './steps/CompletionStep';
import { CompletionStep } from './steps/CompletionStep';
import { CreateBinStep } from './steps/CreateBinStep';
import { DemoAiShowcase } from './steps/DemoAiShowcase';
import { DemoBrowseStep } from './steps/DemoBrowseStep';
import { DemoWelcomeStep } from './steps/DemoWelcomeStep';
import { QrPreviewStep } from './steps/QrPreviewStep';
import { WelcomeStep } from './steps/WelcomeStep';
import { useOnboardingActions } from './useOnboardingActions';

export type { OnboardingActions };

const DEMO_COMPLETION_ACTIONS: CompletionAction[] = [
  { icon: PackagePlus, label: 'Browse all bins', path: '/bins' },
  { icon: Printer, label: 'Print labels', path: '/print' },
  { icon: QrCode, label: 'Scan a QR code', path: '/scan' },
  { icon: Settings, label: 'Explore settings', path: '/settings' },
];

const PROD_COMPLETION_ACTIONS: CompletionAction[] = [
  { icon: PackagePlus, label: 'Create more bins', path: '/bins' },
  { icon: QrCode, label: 'Scan a QR code', path: '/scan' },
  { icon: Settings, label: 'Explore settings', path: '/settings' },
];

export function OnboardingOverlay(props: OnboardingActions) {
  const { step, totalSteps, locationId, advanceWithLocation, advanceStep, complete, demoMode, activeLocationId } = props;
  const state = useOnboardingActions(props);
  const { displayedStep, transitioning, loading, navigate } = state;
  const dots = Array.from({ length: totalSteps });

  function handleNavigate(path: string) {
    complete();
    navigate(path);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-backdrop)] backdrop-blur-sm">
      <div className="glass-heavy rounded-[var(--radius-xl)] w-full max-w-sm mx-5 px-8 py-8 relative max-h-[85vh] overflow-hidden flex flex-col">
        {/* Close button */}
        <button
          type="button"
          onClick={state.handleSkipSetup}
          disabled={loading}
          aria-label="Close setup"
          className="absolute top-4 right-4 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40 p-1 z-10"
        >
          <X className="h-5 w-5" />
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
        <AnimatedHeight className="overflow-y-auto min-h-0 -mx-2 px-2" disableTransition={displayedStep === 1 && demoMode}>
          <div
            key={displayedStep}
            className={cn(
              !(displayedStep === 1 && demoMode) && 'onboarding-step-enter',
              transitioning && !(displayedStep === 1 && demoMode) && 'onboarding-step-exit',
            )}
          >
          {displayedStep === 0 && demoMode && activeLocationId && (
            <DemoWelcomeStep activeLocationId={activeLocationId} onAdvance={advanceWithLocation} />
          )}
          {displayedStep === 0 && !demoMode && (
            <WelcomeStep
              locationName={state.locationName} setLocationName={state.setLocationName}
              areaNames={state.areaNames} areaInput={state.areaInput} setAreaInput={state.setAreaInput}
              showAreaInput={state.showAreaInput} setShowAreaInput={state.setShowAreaInput}
              handleAddArea={state.handleAddArea} handleRemoveArea={state.handleRemoveArea}
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
              binAreaId={state.binAreaId} setBinAreaId={state.setBinAreaId}
              areaNames={state.areaNames} handleCreateBin={state.handleCreateBin} loading={loading} t={state.t}
            />
          )}
          {displayedStep === 2 && demoMode && (
            <DemoBrowseStep onNext={advanceStep} />
          )}
          {displayedStep === 2 && !demoMode && state.createdBin && (
            <QrPreviewStep
              createdBin={state.createdBin}
              onPrint={() => handleNavigate('/print')}
              onNext={advanceStep}
              t={state.t}
            />
          )}
          {displayedStep === 3 && demoMode && (
            <CompletionStep
              icon={<div className="h-24 w-24 rounded-full flex items-center justify-center mb-5 bg-[var(--accent)]/10"><BrandIcon className="h-14 w-14 text-[var(--accent)]" /></div>}
              actions={DEMO_COMPLETION_ACTIONS}
              onAction={handleNavigate}
              onDashboard={() => handleNavigate('/')}
            />
          )}
          {displayedStep === 3 && !demoMode && (
            <AiShowcaseStep
              onSetUpNow={() => handleNavigate('/settings#ai-settings')}
              onSkip={advanceStep}
            />
          )}
          {displayedStep === 4 && !demoMode && (
            <CompletionStep
              icon={<div className="h-16 w-16 rounded-full flex items-center justify-center mb-5 bg-[var(--accent)]/10"><Sparkles className="h-8 w-8 text-[var(--accent)]" /></div>}
              actions={PROD_COMPLETION_ACTIONS}
              onAction={handleNavigate}
              onDashboard={() => handleNavigate('/')}
            />
          )}
          </div>
        </AnimatedHeight>

      </div>
    </div>
  );
}

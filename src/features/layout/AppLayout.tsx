import { ArrowUpRight, Download, X } from 'lucide-react';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageTransition } from '@/components/page-transition';
import { Button } from '@/components/ui/button';
import { CommandPalette } from '@/components/ui/command-palette';
import { ShortcutsHelp } from '@/components/ui/shortcuts-help';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { useBinList } from '@/features/bins/useBins';
import { useLocationList } from '@/features/locations/useLocations';
import { OnboardingOverlay } from '@/features/onboarding/OnboardingOverlay';
import { useOnboarding } from '@/features/onboarding/useOnboarding';
import { ScanDialogContext } from '@/features/qrcode/ScanDialogContext';
import { TagColorsProvider } from '@/features/tags/TagColorsContext';
import { TourBanner } from '@/features/tour/TourBanner';
import { TourOverlay } from '@/features/tour/TourOverlay';
import { getCommandInputRef, TourProvider } from '@/features/tour/TourProvider';
import { TOUR_VERSION, type TourContext } from '@/features/tour/tourSteps';
import { useTour } from '@/features/tour/useTour';
import { useAppSettings } from '@/lib/appSettings';
import { useAuth } from '@/lib/auth';
import { useNavigationGuard } from '@/lib/navigationGuard';
import { useTerminology } from '@/lib/terminology';
import { useTheme } from '@/lib/theme';
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts';
import { usePermissions } from '@/lib/usePermissions';
import { usePlan } from '@/lib/usePlan';
import { useUserPreferences } from '@/lib/userPreferences';
import { toggleSidebarCollapsed, useSidebarCollapsed } from '@/lib/useSidebarCollapsed';
import { cn } from '@/lib/utils';
import { DrawerProvider } from './DrawerContext';
import { MobileDrawer } from './MobileDrawer';
import { Sidebar, SidebarContent } from './Sidebar';

const ScanDialog = React.lazy(() =>
  import('@/features/qrcode/ScanDialog').then((m) => ({ default: m.ScanDialog })),
);

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function AppLayout() {
  useTheme();
  const { isCollapsed: sidebarCollapsed } = useSidebarCollapsed();
  const { settings } = useAppSettings();
  const { activeLocationId, setActiveLocationId, demoMode } = useAuth();
  const { locations, isLoading: locationsLoading } = useLocationList();
  const onboarding = useOnboarding(demoMode);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('openbin-install-dismissed') === '1');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const scanMounted = useRef(false);
  if (scanDialogOpen) scanMounted.current = true;
  const openScanDialog = useCallback(() => setScanDialogOpen(true), []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { preferences, updatePreferences } = useUserPreferences();
  const { canWrite } = usePermissions();
  const { isLocked, isSelfHosted, planInfo } = usePlan();
  const showLockedBanner = isLocked && !isSelfHosted;
  const { settings: aiSettings } = useAiSettings();
  const terminology = useTerminology();
  const { bins } = useBinList();
  const firstBinId = bins.length > 0 ? bins[0].id : null;
  const [isMobile] = useState(() => !window.matchMedia('(min-width: 1024px)').matches);

  const tourContext = useMemo<TourContext>(() => ({
    canWrite,
    aiEnabled: aiSettings !== null,
    firstBinId,
    binIds: bins.map(b => b.id),
    terminology,
    isMobile,
    openCommandInput: () => getCommandInputRef().current?.open(),
    closeCommandInput: () => getCommandInputRef().current?.close(),
  }), [canWrite, aiSettings, firstBinId, bins, terminology, isMobile]);

  const rawNavigate = useNavigate();
  const location = useLocation();
  const { guardedNavigate } = useNavigationGuard();
  const navigate = useCallback(
    (path: string, opts?: { state?: unknown }) => guardedNavigate(() => rawNavigate(path, opts)),
    [rawNavigate, guardedNavigate],
  );

  const tour = useTour({ context: tourContext, navigate, updatePreferences });

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const shortcutActions = useMemo<Record<string, () => void>>(() => ({
    'go-home': () => navigate('/'),
    'go-bins': () => navigate('/bins'),
    'go-scan': openScanDialog,
    'go-print': () => navigate('/print'),
    'go-locations': () => navigate('/locations'),
    'go-items': () => navigate('/items'),
    'go-tags': () => navigate('/tags'),
    'go-settings': () => navigate('/settings'),
    'new-bin': () => navigate('/bins', { state: { create: true } }),
    'focus-search': () => {
      const el = document.querySelector<HTMLInputElement>('[data-shortcut-search]');
      el?.focus();
    },
    'command-palette': () => setCommandPaletteOpen(true),
    'shortcuts-help': () => setShortcutsHelpOpen(true),
    'toggle-sidebar': () => toggleSidebarCollapsed(),
  }), [navigate, openScanDialog]);

  useKeyboardShortcuts({ actions: shortcutActions, enabled: !onboarding.isOnboarding && preferences.keyboard_shortcuts_enabled });

  // If the user already has locations before onboarding even started (e.g. completed on
  // another device), mark it done locally so the overlay never shows. Only check once —
  // the first time locations finish loading — to avoid a race condition where
  // createLocation's notifyLocationsChanged() refetch resolves before advanceWithLocation
  // updates the step from 0 to 1, which would incorrectly auto-complete the onboarding.
  const didAutoCompleteCheck = useRef(false);
  useEffect(() => {
    if (didAutoCompleteCheck.current) return;
    if (locationsLoading || onboarding.isLoading) return;
    didAutoCompleteCheck.current = true;
    if (!demoMode && locations.length > 0 && onboarding.isOnboarding && onboarding.step === 0) {
      onboarding.complete();
    }
  }, [locationsLoading, locations.length, onboarding, onboarding.isLoading]);

  // Auto-select first location when none is active or active location no longer exists
  useEffect(() => {
    if (locations.length > 0) {
      if (!activeLocationId || !locations.some((h) => h.id === activeLocationId)) {
        setActiveLocationId(locations[0].id);
      }
    }
  }, [activeLocationId, locations, setActiveLocationId]);

  useEffect(() => {
    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const showTourBanner =
    preferences.onboarding_completed &&
    !onboarding.isOnboarding &&
    (!preferences.tour_completed || preferences.tour_version < TOUR_VERSION) &&
    !tour.isActive &&
    !locationsLoading;

  const dismissTour = useCallback(() => {
    updatePreferences({ tour_completed: true, tour_version: TOUR_VERSION });
  }, [updatePreferences]);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  }

  return (
    <TagColorsProvider>
    <TourProvider tour={tour}>
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:focus:bg-[var(--accent)] focus:text-[var(--text-on-accent)] focus:text-[14px] focus:font-medium "
      >
        Skip to main content
      </a>
      <Sidebar locations={locations} activeLocationId={activeLocationId} onLocationChange={setActiveLocationId} onScanClick={openScanDialog} />

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <SidebarContent
          locations={locations}
          activeLocationId={activeLocationId}
          onLocationChange={setActiveLocationId}
          onItemClick={() => setDrawerOpen(false)}
          onScanClick={openScanDialog}
        />
      </MobileDrawer>

      <ScanDialogContext.Provider value={{ openScanDialog }}>
      <DrawerProvider isOnboarding={onboarding.isOnboarding} onOpen={() => setDrawerOpen(true)}>
      <main id="main-content" className={cn(
        'pt-[var(--safe-top)] lg:pt-[var(--safe-top)] pb-[calc(16px+var(--safe-bottom))] lg:pb-8 transition-[margin-left] duration-200 ease-in-out',
        sidebarCollapsed ? 'lg:ml-[var(--sidebar-collapsed-width)]' : 'lg:ml-[var(--sidebar-width)]',
      )}>
        {showLockedBanner && (
          <div className="mx-auto w-full max-w-7xl px-4 lg:px-6 pt-4">
            <div className="flat-card flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border-red-500/20 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                Your trial has ended. Subscribe to continue using OpenBin.
              </p>
              {planInfo.upgradeUrl && (
                <a
                  href={planInfo.upgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity shrink-0"
                >
                  Subscribe
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}
        <div className="mx-auto w-full max-w-7xl">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </main>
      </DrawerProvider>
      </ScanDialogContext.Provider>
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onAction={(id) => shortcutActions[id]?.()}
      />
      <ShortcutsHelp open={shortcutsHelpOpen} onOpenChange={setShortcutsHelpOpen} />
      {scanMounted.current && (
        <Suspense fallback={null}>
          <ScanDialog open={scanDialogOpen} onOpenChange={setScanDialogOpen} />
        </Suspense>
      )}
      {/* PWA install toast — fixed bottom-left (mobile) / bottom-right (desktop) */}
      {installPrompt && !dismissed && (
        <div className="fixed z-40 bottom-[calc(16px+var(--safe-bottom))] lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-[360px] flat-heavy rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 fade-in-fast">
          <Download className="h-5 w-5 text-[var(--accent)] shrink-0" />
          <p className="flex-1 text-[14px] text-[var(--text-primary)]">
            Install {settings.appName}
          </p>
          <Button
            size="sm"
            onClick={handleInstall}
            className="h-8 px-3.5 text-[13px]"
          >
            Install
          </Button>
          <button
            type="button"
            onClick={() => { setDismissed(true); localStorage.setItem('openbin-install-dismissed', '1'); }}
            aria-label="Dismiss install prompt"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {onboarding.isOnboarding && !onboarding.isLoading && (locationsLoading ? onboarding.step > 0 : (locations.length === 0 || onboarding.step > 0 || demoMode)) && (
        <OnboardingOverlay
          step={onboarding.step}
          totalSteps={onboarding.totalSteps}
          locationId={onboarding.locationId ?? undefined}
          advanceWithLocation={onboarding.advanceWithLocation}
          advanceStep={onboarding.advanceStep}
          complete={onboarding.complete}
          demoMode={demoMode}
          activeLocationId={activeLocationId ?? undefined}
        />
      )}
      <TourOverlay tour={tour} context={tourContext} />
      {showTourBanner && (
        <TourBanner appName={settings.appName} onStart={tour.start} onDismiss={dismissTour} />
      )}
    </div>
    </TourProvider>
    </TagColorsProvider>
  );
}

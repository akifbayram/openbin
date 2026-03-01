import { Download, X } from 'lucide-react';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageTransition } from '@/components/page-transition';
import { Button } from '@/components/ui/button';
import { CommandPalette } from '@/components/ui/command-palette';
import { ShortcutsHelp } from '@/components/ui/shortcuts-help';
import { useLocationList } from '@/features/locations/useLocations';
import { OnboardingOverlay } from '@/features/onboarding/OnboardingOverlay';
import { useOnboarding } from '@/features/onboarding/useOnboarding';
import { ScanDialogContext } from '@/features/qrcode/ScanDialogContext';
import { TagColorsProvider } from '@/features/tags/TagColorsContext';
import { useAppSettings } from '@/lib/appSettings';
import { useAuth } from '@/lib/auth';
import { useNavigationGuard } from '@/lib/navigationGuard';
import { useTheme } from '@/lib/theme';
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts';
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
  const { activeLocationId, setActiveLocationId } = useAuth();
  const { locations, isLoading: locationsLoading } = useLocationList();
  const onboarding = useOnboarding();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('openbin-install-dismissed') === '1');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const openScanDialog = useCallback(() => setScanDialogOpen(true), []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const rawNavigate = useNavigate();
  const location = useLocation();
  const { guardedNavigate } = useNavigationGuard();
  const navigate = useCallback(
    (path: string, opts?: { state?: unknown }) => guardedNavigate(() => rawNavigate(path, opts)),
    [rawNavigate, guardedNavigate],
  );

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

  useKeyboardShortcuts({ actions: shortcutActions, enabled: !onboarding.isOnboarding });

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
    if (locations.length > 0 && onboarding.isOnboarding && onboarding.step === 0) {
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
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-[var(--radius-full)] focus:bg-[var(--accent)] focus:text-[var(--text-on-accent)] focus:text-[14px] focus:font-medium focus:shadow-lg"
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
      {scanDialogOpen && (
        <Suspense fallback={null}>
          <ScanDialog open={scanDialogOpen} onOpenChange={setScanDialogOpen} />
        </Suspense>
      )}
      {/* PWA install toast — fixed bottom-left (mobile) / bottom-right (desktop) */}
      {installPrompt && !dismissed && (
        <div className="fixed z-40 bottom-[calc(16px+var(--safe-bottom))] lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-[360px] glass-heavy rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 shadow-lg fade-in-fast">
          <Download className="h-5 w-5 text-[var(--accent)] shrink-0" />
          <p className="flex-1 text-[14px] text-[var(--text-primary)]">
            Install {settings.appName}
          </p>
          <Button
            size="sm"
            onClick={handleInstall}
            className="rounded-[var(--radius-full)] h-8 px-3.5 text-[13px]"
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
      {onboarding.isOnboarding && !onboarding.isLoading && !locationsLoading && (locations.length === 0 || onboarding.step > 0) && (
        <OnboardingOverlay
          step={onboarding.step}
          locationId={onboarding.locationId ?? undefined}
          advanceWithLocation={onboarding.advanceWithLocation}
          advanceStep={onboarding.advanceStep}
          complete={onboarding.complete}
        />
      )}
    </div>
    </TagColorsProvider>
  );
}

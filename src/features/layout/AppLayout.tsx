import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { useTheme } from '@/lib/theme';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useAppSettings } from '@/lib/appSettings';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function AppLayout() {
  const { theme, toggleTheme } = useTheme();
  const online = useOnlineStatus();
  const { settings } = useAppSettings();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

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
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-[var(--radius-full)] focus:bg-[var(--accent)] focus:text-[var(--text-on-accent)] focus:text-[14px] focus:font-medium focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Sidebar theme={theme} onToggleTheme={toggleTheme} />
      {/* pb: nav-height(52) + bottom-offset(20) + safe-area + breathing(16) ≈ 88+safe */}
      <main id="main-content" className="lg:ml-[260px] pt-[var(--safe-top)] pb-[calc(88px+var(--safe-bottom))] lg:pb-8">
        <div className="mx-auto w-full max-w-2xl">
          {/* PWA install banner */}
          {installPrompt && !dismissed && (
            <div className="mx-5 mt-4 glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3">
              <Download className="h-5 w-5 text-[var(--accent)] shrink-0" />
              <p className="flex-1 text-[14px] text-[var(--text-primary)]">
                Install {settings.appName} for quick access
              </p>
              <Button
                size="sm"
                onClick={handleInstall}
                className="rounded-[var(--radius-full)] h-8 px-3.5 text-[13px]"
              >
                Install
              </Button>
              <button
                onClick={() => setDismissed(true)}
                aria-label="Dismiss install prompt"
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {!online && (
            <div className="mx-5 mt-4 rounded-[var(--radius-lg)] bg-[var(--bg-input)] px-4 py-2.5 text-center text-[13px] text-[var(--text-secondary)]">
              You're offline — changes are saved locally
            </div>
          )}
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

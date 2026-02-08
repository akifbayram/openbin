import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { useTheme } from '@/lib/theme';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function AppLayout() {
  const { theme, toggleTheme } = useTheme();
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
      <Sidebar theme={theme} onToggleTheme={toggleTheme} />
      {/* pb: nav-height(52) + bottom-offset(20) + safe-area + breathing(16) ≈ 88+safe */}
      <main className="lg:ml-[var(--sidebar-width)] pb-[calc(88px+var(--safe-bottom))] lg:pb-8">
        <div className="mx-auto w-full max-w-2xl">
          {/* PWA install banner */}
          {installPrompt && !dismissed && (
            <div className="mx-[var(--page-px)] mt-4 glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3">
              <Download className="h-5 w-5 text-[var(--accent)] shrink-0" />
              <p className="flex-1 text-[14px] text-[var(--text-primary)]">
                Install QR Bin for quick access
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
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

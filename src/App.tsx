import React, { Suspense, useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { ChevronLeft, AlertCircle, DatabaseZap } from 'lucide-react';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { AppLayout } from '@/features/layout/AppLayout';
import { BinListPage } from '@/features/bins/BinListPage';
import { BinDetailPage } from '@/features/bins/BinDetailPage';
import { Button } from '@/components/ui/button';

const QRScannerPage = React.lazy(() =>
  import('@/features/qrcode/QRScannerPage').then((m) => ({ default: m.QRScannerPage }))
);

const PrintPage = React.lazy(() =>
  import('@/features/print/PrintPage').then((m) => ({ default: m.PrintPage }))
);

const SettingsPage = React.lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 rounded-full border-2 border-[var(--bg-active)] border-t-[var(--accent)] animate-spin" />
    </div>
  );
}

function IndexedDBUnavailable() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-5 px-6 bg-[var(--bg-base)] text-[var(--text-primary)]">
      <DatabaseZap className="h-16 w-16 text-[var(--destructive)] opacity-60" />
      <h1 className="text-[22px] font-bold">Storage Unavailable</h1>
      <p className="text-[15px] text-[var(--text-secondary)] text-center max-w-sm">
        QR Bin Inventory requires IndexedDB to store your data. This may be
        unavailable in private browsing mode or if storage is disabled.
      </p>
      <Button
        onClick={() => window.location.reload()}
        className="rounded-[var(--radius-full)] mt-2"
      >
        Retry
      </Button>
    </div>
  );
}

function IndexedDBCheck({ children }: { children: React.ReactNode }) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const request = indexedDB.open('__idb_check');
      request.onsuccess = () => {
        request.result.close();
        indexedDB.deleteDatabase('__idb_check');
        setAvailable(true);
      };
      request.onerror = () => setAvailable(false);
    } catch {
      setAvailable(false);
    }
  }, []);

  if (available === null) return null;
  if (!available) return <IndexedDBUnavailable />;
  return <>{children}</>;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh flex flex-col items-center justify-center gap-5 px-6 bg-[var(--bg-base)] text-[var(--text-primary)]">
          <AlertCircle className="h-16 w-16 text-[var(--destructive)] opacity-60" />
          <h1 className="text-[22px] font-bold">Something went wrong</h1>
          <p className="text-[15px] text-[var(--text-secondary)] text-center max-w-sm">
            An unexpected error occurred. Please reload the app to continue.
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="rounded-[var(--radius-full)] mt-2"
          >
            Reload App
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function SWUpdateNotifier() {
  const { showToast } = useToast();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast({
                message: 'New version available',
                duration: 10000,
                action: {
                  label: 'Refresh',
                  onClick: () => window.location.reload(),
                },
              });
            }
          });
        });
      });
    }
  }, [showToast]);

  return null;
}

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
      <p className="text-[48px] font-bold text-[var(--text-primary)]">404</p>
      <p className="text-[17px] font-semibold text-[var(--text-secondary)]">Page not found</p>
      <Button variant="outline" onClick={() => navigate('/')} className="rounded-[var(--radius-full)]">
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to bins
      </Button>
    </div>
  );
}

export default function App() {
  return (
    <IndexedDBCheck>
      <ErrorBoundary>
        <HashRouter>
          <ToastProvider>
            <SWUpdateNotifier />
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<BinListPage />} />
                <Route path="/bin/:id" element={<BinDetailPage />} />
                <Route
                  path="/scan"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <QRScannerPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/print"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <PrintPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <SettingsPage />
                    </Suspense>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </ToastProvider>
        </HashRouter>
      </ErrorBoundary>
    </IndexedDBCheck>
  );
}

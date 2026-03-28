import { AlertCircle, ChevronLeft } from 'lucide-react';
import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { AuthGuard } from '@/features/auth/AuthGuard';
import { AppLayout } from '@/features/layout/AppLayout';
import { LocationProvider } from '@/features/locations/useLocations';
import { useScanDialog } from '@/features/qrcode/ScanDialogContext';
import { AuthProvider } from '@/lib/auth';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { NavigationGuardProvider } from '@/lib/navigationGuard';
import { initQrConfig } from '@/lib/qrConfig';
import { PlanProvider } from '@/lib/usePlan';
import { UserPreferencesProvider } from '@/lib/userPreferences';

// Fire-and-forget: fetch QR config early. getQrConfig() returns safe default (app mode) until this resolves.
initQrConfig();

const BinListPage = lazyWithRetry(() =>
  import('@/features/bins/BinListPage').then((m) => ({ default: m.BinListPage }))
);
const BinDetailPage = lazyWithRetry(() =>
  import('@/features/bins/BinDetailPage').then((m) => ({ default: m.BinDetailPage }))
);

const LoginPage = lazyWithRetry(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);

const RegisterPage = lazyWithRetry(() =>
  import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage }))
);

const SharedBinPage = lazyWithRetry(() =>
  import('@/features/bins/SharedBinPage').then((m) => ({ default: m.SharedBinPage }))
);

const ResetPasswordPage = lazyWithRetry(() =>
  import('@/features/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);

const PrintPage = lazyWithRetry(() =>
  import('@/features/print/PrintPage').then((m) => ({ default: m.PrintPage }))
);

const SettingsPage = lazyWithRetry(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

const ProfilePage = lazyWithRetry(() =>
  import('@/features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);

const TagsPage = lazyWithRetry(() =>
  import('@/features/tags/TagsPage').then((m) => ({ default: m.TagsPage }))
);

const DashboardPage = lazyWithRetry(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);

const ItemsPage = lazyWithRetry(() =>
  import('@/features/items/ItemsPage').then((m) => ({ default: m.ItemsPage }))
);

const AreasPage = lazyWithRetry(() =>
  import('@/features/areas/AreasPage').then((m) => ({ default: m.AreasPage }))
);

const TrashPage = lazyWithRetry(() =>
  import('@/features/bins/TrashPage').then((m) => ({ default: m.TrashPage }))
);

const ActivityPage = lazyWithRetry(() =>
  import('@/features/activity/ActivityPage').then((m) => ({ default: m.ActivityPage }))
);

const ReorganizePage = lazyWithRetry(() =>
  import('@/features/reorganize/ReorganizePage').then((m) => ({ default: m.ReorganizePage }))
);

const CapturePage = lazyWithRetry(() =>
  import('@/features/capture/CapturePage').then((m) => ({ default: m.CapturePage }))
);

const AdminUsersPage = lazyWithRetry(() =>
  import('@/features/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage }))
);

const AdminUserDetailPage = lazyWithRetry(() =>
  import('@/features/admin/AdminUserDetailPage').then((m) => ({ default: m.AdminUserDetailPage }))
);

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 rounded-full border-2 border-[var(--bg-active)] border-t-[var(--accent)] animate-spin" />
    </div>
  );
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
          <h1 className="font-heading text-[22px] font-bold">Something went wrong</h1>
          <p className="text-[15px] text-[var(--text-secondary)] text-center max-w-sm">
            An unexpected error occurred. Please reload the app to continue.
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-2"
          >
            Reload App
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

let controllerChangeReloaded = false;

function SWUpdateNotifier() {
  const { showToast } = useToast();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // When a new SW takes control (e.g. skipWaiting after autoUpdate),
    // reload once so the page uses fresh assets matching the new cache.
    // Skip if there's no existing controller — that means this is the
    // first install, not an update, so no reload is needed.
    const hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (!hadController || controllerChangeReloaded) return;
      controllerChangeReloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

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

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, [showToast]);

  return null;
}

function PlanErrorNotifier() {
  const { showToast } = useToast();

  useEffect(() => {
    const handler = (e: Event) => {
      const { code, upgradeUrl } = (e as CustomEvent).detail ?? {};
      const message = code === 'SUBSCRIPTION_EXPIRED'
        ? 'Your subscription has expired'
        : 'This feature requires a Pro plan';
      showToast({
        message,
        variant: 'warning',
        duration: 6000,
        ...(upgradeUrl ? { action: { label: 'Upgrade', onClick: () => window.open(upgradeUrl, '_blank') } } : {}),
      });
    };
    window.addEventListener('openbin-plan-restricted', handler);
    return () => window.removeEventListener('openbin-plan-restricted', handler);
  }, [showToast]);

  return null;
}

function ScanRedirect() {
  const { openScanDialog } = useScanDialog();
  useEffect(() => { openScanDialog(); }, [openScanDialog]);
  return <Navigate to="/" replace />;
}

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
      <p className="font-heading text-[48px] font-bold text-[var(--text-primary)]">404</p>
      <p className="text-[17px] font-semibold text-[var(--text-secondary)]">Page not found</p>
      <Button variant="outline" onClick={() => navigate('/')}>
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to home
      </Button>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <NavigationGuardProvider>
        <ToastProvider>
          <AuthProvider>
            <SWUpdateNotifier />
            <PlanErrorNotifier />
            <Routes>
              {/* Public routes */}
              <Route
                path="/login"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <LoginPage />
                  </Suspense>
                }
              />
              <Route
                path="/register"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <RegisterPage />
                  </Suspense>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ResetPasswordPage />
                  </Suspense>
                }
              />
              <Route
                path="/s/:token"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <SharedBinPage />
                  </Suspense>
                }
              />

              {/* Protected routes */}
              <Route
                element={
                  <AuthGuard>
                    <LocationProvider>
                      <PlanProvider>
                        <UserPreferencesProvider>
                          <AppLayout />
                        </UserPreferencesProvider>
                      </PlanProvider>
                    </LocationProvider>
                  </AuthGuard>
                }
              >
                <Route
                  path="/"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <DashboardPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/bins"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <BinListPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/bin/:id"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <BinDetailPage />
                    </Suspense>
                  }
                />
                <Route path="/scan" element={<ScanRedirect />} />
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
                <Route
                  path="/tags"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <TagsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/items"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <ItemsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/locations"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <AreasPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/trash"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <TrashPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/activity"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <ActivityPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <ProfilePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/reorganize"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <ReorganizePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/capture"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <CapturePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <AdminUsersPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/admin/users/:id"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <AdminUserDetailPage />
                    </Suspense>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </ToastProvider>
        </NavigationGuardProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

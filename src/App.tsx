import React, { Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/toast';
import { AppLayout } from '@/features/layout/AppLayout';
import { BinListPage } from '@/features/bins/BinListPage';
import { BinDetailPage } from '@/features/bins/BinDetailPage';

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
    <div className="flex items-center justify-center py-20 text-[var(--text-tertiary)]">
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
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
          </Route>
        </Routes>
      </ToastProvider>
    </HashRouter>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Monitor, Download, Upload, AlertTriangle, RotateCcw, LogOut, ChevronRight, Trash2, Clock, FileArchive, FileSpreadsheet } from 'lucide-react';
import { Disclosure } from '@/components/ui/disclosure';
import { getAvatarUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useTheme } from '@/lib/theme';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAppSettings } from '@/lib/appSettings';
import { useTerminology } from '@/lib/terminology';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/lib/usePermissions';
import { useBinList } from '@/features/bins/useBins';
import type { ExportData } from '@/types';
import {
  exportAllData,
  downloadExport,
  exportZip,
  exportCsv,
  parseImportFile,
  importData,
  ImportError,
} from './exportImport';
import { Switch } from '@/components/ui/switch';
import { AiSettingsSection } from '@/features/ai/AiSettingsSection';
import { ApiKeysSection } from './ApiKeysSection';
import { useDashboardSettings, DASHBOARD_LIMITS } from '@/lib/dashboardSettings';

export function SettingsPage() {
  const navigate = useNavigate();
  const { preference, setThemePreference } = useTheme();
  const { aiEnabled, setAiEnabled } = useAiEnabled();
  const { settings, updateSettings, resetSettings } = useAppSettings();
  const t = useTerminology();
  const { user, activeLocationId, logout, deleteAccount } = useAuth();
  const { isAdmin } = usePermissions();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingData, setPendingData] = useState<ExportData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Delete account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const { bins } = useBinList();
  const binCount = bins.length;
  const { settings: dashSettings, updateSettings: updateDashSettings } = useDashboardSettings();

  // Scroll to AI settings section when navigated with #ai-settings hash
  useEffect(() => {
    if (window.location.hash === '#ai-settings') {
      const el = document.getElementById('ai-settings');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  async function handleExport() {
    if (!activeLocationId) {
      showToast({ message: 'Select a location first' });
      return;
    }
    setExporting(true);
    try {
      const data = await exportAllData(activeLocationId);
      downloadExport(data);
      showToast({ message: 'Backup exported successfully' });
    } catch {
      showToast({ message: 'Export failed' });
    } finally {
      setExporting(false);
    }
  }

  async function handleExportZip() {
    if (!activeLocationId) {
      showToast({ message: 'Select a location first' });
      return;
    }
    setExportingZip(true);
    try {
      await exportZip(activeLocationId);
      showToast({ message: 'ZIP backup exported successfully' });
    } catch {
      showToast({ message: 'ZIP export failed' });
    } finally {
      setExportingZip(false);
    }
  }

  async function handleExportCsv() {
    if (!activeLocationId) {
      showToast({ message: 'Select a location first' });
      return;
    }
    setExportingCsv(true);
    try {
      await exportCsv(activeLocationId);
      showToast({ message: 'CSV exported successfully' });
    } catch {
      showToast({ message: 'CSV export failed' });
    } finally {
      setExportingCsv(false);
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function importErrorMessage(err: unknown): string {
    if (err instanceof ImportError) {
      switch (err.code) {
        case 'FILE_TOO_LARGE': return 'File is too large (max 100 MB)';
        case 'INVALID_JSON': return 'File is not valid JSON';
        case 'INVALID_FORMAT': return 'Invalid backup file format';
      }
    }
    return 'Failed to read backup file';
  }

  async function handleFileSelected(files: FileList | null) {
    if (!files?.[0] || !activeLocationId) return;
    try {
      const data = await parseImportFile(files[0]);
      setPendingData(data);
      const result = await importData(activeLocationId, data, 'merge');
      showToast({
        message: `Imported ${result.binsImported} bin${result.binsImported !== 1 ? 's' : ''}${result.photosImported ? `, ${result.photosImported} photo${result.photosImported !== 1 ? 's' : ''}` : ''}${result.binsSkipped ? ` (${result.binsSkipped} skipped)` : ''}`,
      });
      setPendingData(null);
    } catch (err) {
      showToast({ message: importErrorMessage(err) });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleReplaceImport() {
    if (!pendingData || !activeLocationId) return;
    try {
      const result = await importData(activeLocationId, pendingData, 'replace');
      showToast({
        message: `Replaced all data: ${result.binsImported} bin${result.binsImported !== 1 ? 's' : ''}${result.photosImported ? `, ${result.photosImported} photo${result.photosImported !== 1 ? 's' : ''}` : ''}`,
      });
    } catch {
      showToast({ message: 'Replace import failed' });
    }
    setPendingData(null);
    setConfirmReplace(false);
  }

  async function handleReplaceFileSelected(files: FileList | null) {
    if (!files?.[0]) return;
    try {
      const data = await parseImportFile(files[0]);
      setPendingData(data);
      setConfirmReplace(true);
    } catch (err) {
      showToast({ message: importErrorMessage(err) });
    }
    if (replaceInputRef.current) replaceInputRef.current.value = '';
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!deletePassword) return;
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to delete account' });
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2 max-w-2xl mx-auto">
      <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
        Settings
      </h1>

      {/* Account */}
      {user && (
        <Card>
          <CardContent>
            <Label>Account</Label>
            <div className="flex flex-col gap-3 mt-3">
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] transition-colors w-full text-left"
              >
                {user.avatarUrl ? (
                  <img src={getAvatarUrl(user.avatarUrl)} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-[var(--bg-active)] flex items-center justify-center text-[14px] font-semibold text-[var(--text-secondary)] shrink-0">
                    {user.displayName?.[0]?.toUpperCase() || user.username[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-[var(--text-primary)] truncate">
                    {user.displayName || user.username}
                  </p>
                  <p className="text-[13px] text-[var(--text-tertiary)]">@{user.username}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
              </button>
              <Button
                variant="outline"
                onClick={logout}
                className="justify-start rounded-[var(--radius-sm)] h-11 text-[var(--destructive)]"
              >
                <LogOut className="h-4 w-4 mr-2.5" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appearance */}
      <Card>
        <CardContent>
          <Label>Appearance</Label>
          <div className="flex mt-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)] p-1 gap-1">
            {([
              { value: 'light' as const, icon: Sun, label: 'Light' },
              { value: 'dark' as const, icon: Moon, label: 'Dark' },
              { value: 'auto' as const, icon: Monitor, label: 'Auto' },
            ]).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setThemePreference(value)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-[var(--radius-xs)] text-[14px] font-medium transition-colors ${
                  preference === value
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Personalization (admin only — modifies location-level settings) */}
      {isAdmin && (
        <Card>
          <CardContent>
            <Label>Personalization</Label>
            <div className="flex flex-col gap-3 mt-3">
              <div className="space-y-1.5">
                <label htmlFor="app-name" className="text-[13px] text-[var(--text-secondary)]">App Name</label>
                <Input
                  id="app-name"
                  value={settings.appName}
                  onChange={(e) => updateSettings({ appName: e.target.value })}
                  placeholder="OpenBin"
                />
              </div>
              <Disclosure label="Custom Terminology">
                <p className="text-[11px] text-[var(--text-tertiary)] mb-2">Rename core concepts to match your workflow.</p>
                <div className="space-y-2">
                  {([
                    { key: 'termBin' as const, singular: 'Bin', plural: 'Bins' },
                    { key: 'termLocation' as const, singular: 'Location', plural: 'Locations' },
                    { key: 'termArea' as const, singular: 'Area', plural: 'Areas' },
                  ]).map(({ key, singular, plural }) => {
                    const raw = settings[key];
                    const parts = raw ? raw.split('|') : ['', ''];
                    return (
                      <div key={key} className="grid grid-cols-2 gap-2">
                        <Input
                          value={parts[0] || ''}
                          onChange={(e) => {
                            const newSingular = e.target.value;
                            const newPlural = parts[1] || '';
                            updateSettings({ [key]: newSingular || newPlural ? `${newSingular}|${newPlural}` : '' });
                          }}
                          placeholder={`${singular} (singular)`}
                        />
                        <Input
                          value={parts[1] || ''}
                          onChange={(e) => {
                            const newSingular = parts[0] || '';
                            const newPlural = e.target.value;
                            updateSettings({ [key]: newSingular || newPlural ? `${newSingular}|${newPlural}` : '' });
                          }}
                          placeholder={`${plural} (plural)`}
                        />
                      </div>
                    );
                  })}
                </div>
              </Disclosure>
              <Button
                variant="outline"
                onClick={resetSettings}
                className="justify-start rounded-[var(--radius-sm)] h-11"
              >
                <RotateCcw className="h-4 w-4 mr-2.5" />
                Reset to Default
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard */}
      <Card>
        <CardContent>
          <Label>Dashboard</Label>
          <div className="flex flex-col gap-3 mt-3">
            <div className="space-y-1.5">
              <div className="flex flex-col gap-2">
                {([
                  { key: 'showStats' as const, label: 'Stats' },
                  { key: 'showNeedsOrganizing' as const, label: 'Needs Organizing' },
                  { key: 'showSavedViews' as const, label: 'Saved Views' },
                  { key: 'showPinnedBins' as const, label: `Pinned ${t.Bins}` },
                  { key: 'showRecentlyScanned' as const, label: 'Recently Scanned' },
                  { key: 'showRecentlyUpdated' as const, label: 'Recently Updated' },
                ]).map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span className="text-[14px] text-[var(--text-primary)]">{label}</span>
                    <Switch
                      checked={dashSettings[key]}
                      onCheckedChange={(checked) => updateDashSettings({ [key]: checked })}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="recent-bins" className="text-[13px] text-[var(--text-secondary)]">Recent {t.bins} shown</label>
                <Input
                  id="recent-bins"
                  type="number"
                  min={DASHBOARD_LIMITS.recentBinsCount.min}
                  max={DASHBOARD_LIMITS.recentBinsCount.max}
                  value={dashSettings.recentBinsCount}
                  onChange={(e) => updateDashSettings({ recentBinsCount: Number(e.target.value) })}
                />
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  {DASHBOARD_LIMITS.recentBinsCount.min}–{DASHBOARD_LIMITS.recentBinsCount.max}
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="scan-history" className="text-[13px] text-[var(--text-secondary)]">Scan history entries</label>
                <Input
                  id="scan-history"
                  type="number"
                  min={DASHBOARD_LIMITS.scanHistoryMax.min}
                  max={DASHBOARD_LIMITS.scanHistoryMax.max}
                  value={dashSettings.scanHistoryMax}
                  onChange={(e) => updateDashSettings({ scanHistoryMax: Number(e.target.value) })}
                />
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  {DASHBOARD_LIMITS.scanHistoryMax.min}–{DASHBOARD_LIMITS.scanHistoryMax.max}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Settings (admin only) */}
      {isAdmin && <AiSettingsSection aiEnabled={aiEnabled} onToggle={setAiEnabled} />}

      {/* API Keys (admin only) */}
      {isAdmin && aiEnabled && <ApiKeysSection />}

      {/* Data (admin only) */}
      {isAdmin && <Card>
        <CardContent>
          <Label>Data</Label>
          <div className="flex flex-col gap-2 mt-3">
            <Button
              variant="outline"
              onClick={() => navigate('/activity')}
              className="justify-start rounded-[var(--radius-sm)] h-11"
            >
              <Clock className="h-4 w-4 mr-2.5" />
              Activity Log
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/trash')}
              className="justify-start rounded-[var(--radius-sm)] h-11"
            >
              <Trash2 className="h-4 w-4 mr-2.5" />
              Trash
            </Button>
            <Button
              variant="outline"
              onClick={handleExportZip}
              disabled={exportingZip || !activeLocationId}
              className="justify-start rounded-[var(--radius-sm)] h-11"
            >
              <FileArchive className="h-4 w-4 mr-2.5" />
              {exportingZip ? 'Exporting...' : 'Export Backup (ZIP)'}
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting || !activeLocationId}
              className="justify-start rounded-[var(--radius-sm)] h-11"
            >
              <Download className="h-4 w-4 mr-2.5" />
              {exporting ? 'Exporting...' : 'Export Backup (JSON)'}
            </Button>
            <Button
              variant="outline"
              onClick={handleExportCsv}
              disabled={exportingCsv || !activeLocationId}
              className="justify-start rounded-[var(--radius-sm)] h-11"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2.5" />
              {exportingCsv ? 'Exporting...' : 'Export Spreadsheet (CSV)'}
            </Button>
            <Button
              variant="outline"
              onClick={handleImportClick}
              disabled={!activeLocationId}
              className="justify-start rounded-[var(--radius-sm)] h-11"
            >
              <Upload className="h-4 w-4 mr-2.5" />
              Import Backup (Merge)
            </Button>
            <Button
              variant="outline"
              onClick={() => replaceInputRef.current?.click()}
              disabled={!activeLocationId}
              className="justify-start rounded-[var(--radius-sm)] h-11 text-[var(--destructive)]"
            >
              <AlertTriangle className="h-4 w-4 mr-2.5" />
              Import Backup (Replace All)
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => handleFileSelected(e.target.files)}
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => handleReplaceFileSelected(e.target.files)}
          />
        </CardContent>
      </Card>}

      {/* About */}
      <Card>
        <CardContent>
          <Label>About</Label>
          <div className="mt-3 space-y-2 text-[15px] text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">{settings.appName}</p>
            <p>{binCount} {binCount !== 1 ? t.bins : t.bin}</p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {user && (
        <Card>
          <CardContent>
            <Label>Danger Zone</Label>
            <div className="flex flex-col gap-2 mt-3">
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(true)}
                className="justify-start rounded-[var(--radius-sm)] h-11 text-[var(--destructive)] border-[var(--destructive)]/30"
              >
                <Trash2 className="h-4 w-4 mr-2.5" />
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Account confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) { setDeletePassword(''); setDeleting(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all data in locations where you are the only member. Locations shared with others will be preserved. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeleteAccount} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="delete-password">Enter your password to confirm</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Password"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setDeleteOpen(false); setDeletePassword(''); }}
                className="rounded-[var(--radius-full)]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!deletePassword || deleting}
                className="rounded-[var(--radius-full)] bg-[var(--destructive)] hover:opacity-90"
              >
                {deleting ? 'Deleting...' : 'Delete Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Replace confirmation dialog */}
      <Dialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace All Data?</DialogTitle>
            <DialogDescription>
              This will delete all existing bins and photos in the current location, then import from the backup file. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmReplace(false);
                setPendingData(null);
              }}
              className="rounded-[var(--radius-full)]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReplaceImport}
              className="rounded-[var(--radius-full)] bg-[var(--destructive)] hover:opacity-90"
            >
              Replace All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

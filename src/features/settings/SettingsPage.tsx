import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Monitor, Download, Upload, AlertTriangle, RotateCcw, LogOut, MapPin, Plus, LogIn, Users, Crown, ChevronRight, Trash2, Pencil, Clock, FileArchive, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useAppSettings } from '@/lib/appSettings';
import { useAuth } from '@/lib/auth';
import { useBinList } from '@/features/bins/useBins';
import { useLocationList, createLocation, joinLocation, updateLocation, deleteLocation } from '@/features/locations/useLocations';
import { LocationMembersDialog } from '@/features/locations/LocationMembersDialog';
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
import { AiSettingsSection } from '@/features/ai/AiSettingsSection';

export function SettingsPage() {
  const navigate = useNavigate();
  const { preference, setThemePreference } = useTheme();
  const { settings, updateSettings, resetSettings } = useAppSettings();
  const { user, activeLocationId, setActiveLocationId, logout, deleteAccount } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingData, setPendingData] = useState<ExportData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Locations state
  const { locations, isLoading: locationsLoading } = useLocationList();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [membersLocationId, setMembersLocationId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  // Rename location state
  const [renameLocationId, setRenameLocationId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Delete location state
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);
  const [deletingLocation, setDeletingLocation] = useState(false);
  const deleteLocationName = locations.find((h) => h.id === deleteLocationId)?.name ?? '';

  // Delete account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const { bins } = useBinList();
  const binCount = bins.length;

  async function handleCreateLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const location = await createLocation(newName.trim());
      setActiveLocationId(location.id);
      setNewName('');
      setCreateOpen(false);
      showToast({ message: `Created "${location.name}"` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to create location' });
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoining(true);
    try {
      const location = await joinLocation(inviteCode.trim());
      setActiveLocationId(location.id);
      setInviteCode('');
      setJoinOpen(false);
      showToast({ message: `Joined "${location.name}"` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to join location' });
    } finally {
      setJoining(false);
    }
  }

  async function handleRenameLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!renameLocationId || !renameValue.trim()) return;
    setRenaming(true);
    try {
      await updateLocation(renameLocationId, renameValue.trim());
      setRenameLocationId(null);
      showToast({ message: 'Location renamed' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to rename location' });
    } finally {
      setRenaming(false);
    }
  }

  async function handleDeleteLocation() {
    if (!deleteLocationId) return;
    setDeletingLocation(true);
    try {
      await deleteLocation(deleteLocationId);
      if (activeLocationId === deleteLocationId) {
        const remaining = locations.filter((h) => h.id !== deleteLocationId);
        setActiveLocationId(remaining.length > 0 ? remaining[0].id : null);
      }
      setDeleteLocationId(null);
      showToast({ message: 'Location deleted' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to delete location' });
    } finally {
      setDeletingLocation(false);
    }
  }

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
    <div className="flex flex-col gap-4 px-5 pt-6 pb-2 max-w-2xl mx-auto">
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
                  <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
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

      {/* Locations */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label>Locations</Label>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setJoinOpen(true)}
                className="rounded-[var(--radius-full)] h-8 px-3"
              >
                <LogIn className="h-3.5 w-3.5 mr-1.5" />
                Join
              </Button>
              <Button
                onClick={() => setCreateOpen(true)}
                size="icon"
                className="h-8 w-8 rounded-full"
                aria-label="Create location"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-3">
            {locationsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-[var(--radius-sm)]" />
                ))}
              </div>
            ) : locations.length === 0 ? (
              <p className="text-[13px] text-[var(--text-tertiary)] py-4 text-center">
                No locations yet. Create one or join with an invite code.
              </p>
            ) : (
              locations.map((loc) => {
                const isActive = loc.id === activeLocationId;
                const isOwner = loc.created_by === user?.id;
                return (
                  <button
                    key={loc.id}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-[var(--radius-sm)] text-left transition-colors hover:bg-[var(--bg-hover)] ${isActive ? 'ring-2 ring-[var(--accent)] bg-[var(--bg-input)]' : ''}`}
                    onClick={() => setActiveLocationId(loc.id)}
                  >
                    <MapPin className="h-5 w-5 text-[var(--text-secondary)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                          {loc.name}
                        </span>
                        {isOwner && (
                          <Badge variant="secondary" className="text-[11px] gap-1 py-0">
                            <Crown className="h-3 w-3" />
                            Owner
                          </Badge>
                        )}
                        {isActive && (
                          <Badge className="text-[11px] py-0">Active</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-[var(--radius-full)] h-8 px-3"
                        onClick={() => setMembersLocationId(loc.id)}
                      >
                        <Users className="h-3.5 w-3.5 mr-1.5" />
                        Members
                      </Button>
                      {isOwner && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full h-8 w-8"
                            onClick={() => {
                              setRenameLocationId(loc.id);
                              setRenameValue(loc.name);
                            }}
                            aria-label="Rename location"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full h-8 w-8 text-[var(--destructive)]"
                            onClick={() => setDeleteLocationId(loc.id)}
                            aria-label="Delete location"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

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

      {/* Personalization */}
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
                placeholder="Sanduk"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="app-subtitle" className="text-[13px] text-[var(--text-secondary)]">Subtitle</label>
              <Input
                id="app-subtitle"
                value={settings.appSubtitle}
                onChange={(e) => updateSettings({ appSubtitle: e.target.value })}
                placeholder="Inventory"
              />
            </div>
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

      {/* AI Image Analysis */}
      <AiSettingsSection />

      {/* Data */}
      <Card>
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
      </Card>

      {/* About */}
      <Card>
        <CardContent>
          <Label>About</Label>
          <div className="mt-3 space-y-2 text-[15px] text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">{settings.appName} {settings.appSubtitle}</p>
            <p>{binCount} bin{binCount !== 1 ? 's' : ''}</p>
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

      {/* Create Location Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Location</DialogTitle>
            <DialogDescription>
              A location is a shared space where members can manage bins together.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateLocation} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="location-name">Name</Label>
              <Input
                id="location-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., My House, Office"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newName.trim() || creating}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Join Location Dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Location</DialogTitle>
            <DialogDescription>
              Enter the invite code shared by a location owner to join.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleJoinLocation} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="invite-code">Invite Code</Label>
              <Input
                id="invite-code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Enter invite code"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setJoinOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!inviteCode.trim() || joining}>
                {joining ? 'Joining...' : 'Join'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Location Dialog */}
      <Dialog open={!!renameLocationId} onOpenChange={(open) => !open && setRenameLocationId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Location</DialogTitle>
            <DialogDescription>
              Enter a new name for this location.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameLocation} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="rename-location">Name</Label>
              <Input
                id="rename-location"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenameLocationId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim() || renaming}>
                {renaming ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Location Dialog */}
      <Dialog open={!!deleteLocationId} onOpenChange={(open) => !open && setDeleteLocationId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{deleteLocationName}&quot; and all its bins and photos. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteLocationId(null)} className="rounded-[var(--radius-full)]">
              Cancel
            </Button>
            <Button
              onClick={handleDeleteLocation}
              disabled={deletingLocation}
              className="rounded-[var(--radius-full)] bg-[var(--destructive)] hover:opacity-90"
            >
              {deletingLocation ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      {membersLocationId && (
        <LocationMembersDialog
          locationId={membersLocationId}
          open={!!membersLocationId}
          onOpenChange={(open) => !open && setMembersLocationId(null)}
        />
      )}
    </div>
  );
}

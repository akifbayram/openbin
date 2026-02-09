import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Download, Upload, AlertTriangle, RotateCcw, LogOut, Home, Plus, LogIn, Users, Crown, ChevronRight } from 'lucide-react';
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
import { useHomeList, createHome, joinHome } from '@/features/homes/useHomes';
import { HomeMembersDialog } from '@/features/homes/HomeMembersDialog';
import type { ExportData } from '@/types';
import {
  exportAllData,
  downloadExport,
  parseImportFile,
  importData,
  ImportError,
} from './exportImport';

export function SettingsPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { settings, updateSettings, resetSettings } = useAppSettings();
  const { user, activeHomeId, setActiveHomeId, logout } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingData, setPendingData] = useState<ExportData | null>(null);
  const [exporting, setExporting] = useState(false);

  // Homes state
  const { homes, isLoading: homesLoading } = useHomeList();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [membersHomeId, setMembersHomeId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const { bins } = useBinList();
  const binCount = bins.length;

  async function handleCreateHome(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const home = await createHome(newName.trim());
      setActiveHomeId(home.id);
      setNewName('');
      setCreateOpen(false);
      showToast({ message: `Created "${home.name}"` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to create home' });
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinHome(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoining(true);
    try {
      const home = await joinHome(inviteCode.trim());
      setActiveHomeId(home.id);
      setInviteCode('');
      setJoinOpen(false);
      showToast({ message: `Joined "${home.name}"` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to join home' });
    } finally {
      setJoining(false);
    }
  }

  async function handleExport() {
    if (!activeHomeId) {
      showToast({ message: 'Select a home first' });
      return;
    }
    setExporting(true);
    try {
      const data = await exportAllData(activeHomeId);
      downloadExport(data);
      showToast({ message: 'Backup exported successfully' });
    } catch {
      showToast({ message: 'Export failed' });
    } finally {
      setExporting(false);
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
    if (!files?.[0] || !activeHomeId) return;
    try {
      const data = await parseImportFile(files[0]);
      setPendingData(data);
      const result = await importData(activeHomeId, data, 'merge');
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
    if (!pendingData || !activeHomeId) return;
    try {
      const result = await importData(activeHomeId, pendingData, 'replace');
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

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 pb-2">
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

      {/* Homes */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label>Homes</Label>
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
                aria-label="Create home"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-3">
            {homesLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-[var(--radius-sm)]" />
                ))}
              </div>
            ) : homes.length === 0 ? (
              <p className="text-[13px] text-[var(--text-tertiary)] py-4 text-center">
                No homes yet. Create one or join with an invite code.
              </p>
            ) : (
              homes.map((home) => {
                const isActive = home.id === activeHomeId;
                const isOwner = home.created_by === user?.id;
                return (
                  <button
                    key={home.id}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-[var(--radius-sm)] text-left transition-colors hover:bg-[var(--bg-hover)] ${isActive ? 'ring-2 ring-[var(--accent)] bg-[var(--bg-input)]' : ''}`}
                    onClick={() => setActiveHomeId(home.id)}
                  >
                    <Home className="h-5 w-5 text-[var(--text-secondary)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                          {home.name}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 rounded-[var(--radius-full)] h-8 px-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMembersHomeId(home.id);
                      }}
                    >
                      <Users className="h-3.5 w-3.5 mr-1.5" />
                      Members
                    </Button>
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
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full mt-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>
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
                placeholder="QR Bin"
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

      {/* Data */}
      <Card>
        <CardContent>
          <Label>Data</Label>
          <div className="flex flex-col gap-2 mt-3">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting || !activeHomeId}
              className="justify-start rounded-[var(--radius-sm)] h-11"
            >
              <Download className="h-4 w-4 mr-2.5" />
              {exporting ? 'Exporting...' : 'Export Backup'}
            </Button>
            <Button
              variant="outline"
              onClick={handleImportClick}
              disabled={!activeHomeId}
              className="justify-start rounded-[var(--radius-sm)] h-11"
            >
              <Upload className="h-4 w-4 mr-2.5" />
              Import Backup (Merge)
            </Button>
            <Button
              variant="outline"
              onClick={() => replaceInputRef.current?.click()}
              disabled={!activeHomeId}
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

      {/* Replace confirmation dialog */}
      <Dialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace All Data?</DialogTitle>
            <DialogDescription>
              This will delete all existing bins and photos in the current home, then import from the backup file. This action cannot be undone.
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

      {/* Create Home Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Home</DialogTitle>
            <DialogDescription>
              A home is a shared space where members can manage bins together.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateHome} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="home-name">Name</Label>
              <Input
                id="home-name"
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

      {/* Join Home Dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Home</DialogTitle>
            <DialogDescription>
              Enter the invite code shared by a home owner to join.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleJoinHome} className="space-y-5">
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

      {/* Members Dialog */}
      {membersHomeId && (
        <HomeMembersDialog
          homeId={membersHomeId}
          open={!!membersHomeId}
          onOpenChange={(open) => !open && setMembersHomeId(null)}
        />
      )}
    </div>
  );
}

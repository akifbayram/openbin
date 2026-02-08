import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sun, Moon, Download, Upload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { db } from '@/db';
import type { ExportData } from '@/types';
import {
  exportAllData,
  downloadExport,
  validateExportData,
  importData,
} from './exportImport';

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingData, setPendingData] = useState<ExportData | null>(null);
  const [exporting, setExporting] = useState(false);

  const binCount = useLiveQuery(() => db.bins.count());
  const photoCount = useLiveQuery(() => db.photos.count());

  async function handleExport() {
    setExporting(true);
    try {
      const data = await exportAllData();
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

  async function handleFileSelected(files: FileList | null) {
    if (!files?.[0]) return;
    const file = files[0];
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!validateExportData(json)) {
        showToast({ message: 'Invalid backup file format' });
        return;
      }
      // Default: merge. Store data in case user wants replace.
      setPendingData(json);
      const result = await importData(json, 'merge');
      showToast({
        message: `Imported ${result.binsImported} bin${result.binsImported !== 1 ? 's' : ''}${result.photosImported ? `, ${result.photosImported} photo${result.photosImported !== 1 ? 's' : ''}` : ''}${result.binsSkipped ? ` (${result.binsSkipped} skipped)` : ''}`,
      });
      setPendingData(null);
    } catch {
      showToast({ message: 'Failed to read backup file' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleReplaceImport() {
    if (!pendingData) return;
    try {
      const result = await importData(pendingData, 'replace');
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
    const file = files[0];
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!validateExportData(json)) {
        showToast({ message: 'Invalid backup file format' });
        return;
      }
      setPendingData(json);
      setConfirmReplace(true);
    } catch {
      showToast({ message: 'Failed to read backup file' });
    }
  }

  return (
    <div className="flex flex-col gap-4 px-[var(--page-px)] pt-6 pb-2">
      <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
        Settings
      </h1>

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

      {/* Data */}
      <Card>
        <CardContent>
          <Label>Data</Label>
          <div className="flex flex-col gap-2 mt-3">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="justify-start rounded-[var(--radius-sm)] h-11"
            >
              <Download className="h-4 w-4 mr-2.5" />
              {exporting ? 'Exporting...' : 'Export Backup'}
            </Button>
            <Button
              variant="outline"
              onClick={handleImportClick}
              className="justify-start rounded-[var(--radius-sm)] h-11"
            >
              <Upload className="h-4 w-4 mr-2.5" />
              Import Backup (Merge)
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Use a separate ref trick: swap handler temporarily
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = () => handleReplaceFileSelected(input.files);
                input.click();
              }}
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
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardContent>
          <Label>About</Label>
          <div className="mt-3 space-y-2 text-[15px] text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">QR Bin Inventory</p>
            <p>{binCount ?? 0} bin{binCount !== 1 ? 's' : ''} &middot; {photoCount ?? 0} photo{photoCount !== 1 ? 's' : ''}</p>
          </div>
        </CardContent>
      </Card>

      {/* Replace confirmation dialog */}
      <Dialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace All Data?</DialogTitle>
            <DialogDescription>
              This will delete all existing bins and photos, then import from the backup file. This action cannot be undone.
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

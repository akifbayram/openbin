import { Clock, Download, Lock, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LocationSelectList } from '@/features/locations/LocationSelectList';
import { useLocationList } from '@/features/locations/useLocations';
import { useAuth } from '@/lib/auth';
import { usePlan } from '@/lib/usePlan';
import { cn } from '@/lib/utils';
import type { Location } from '@/types';
import { SettingsPageHeader } from '../SettingsPageHeader';
import { SettingsRow } from '../SettingsRow';
import { SettingsSection } from '../SettingsSection';
import { useDataSectionActions } from '../useDataSectionActions';

function LocationPickerSection({
  locations,
  value,
  onChange,
}: {
  locations: Location[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  if (locations.length <= 1) return null;
  return (
    <div className="space-y-2.5">
      <span className="text-[13px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Location</span>
      <div className="max-h-40 overflow-y-auto">
        <LocationSelectList locations={locations} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

export function DataSection() {
  const navigate = useNavigate();
  const { activeLocationId } = useAuth();
  const { isGated, isSelfHosted } = usePlan();
  const exportGated = !isSelfHosted && isGated('fullExport');
  const actions = useDataSectionActions();
  const {
    fileInputRef,
    exportDialogOpen,
    setExportDialogOpen,
    exportFormat,
    setExportFormat,
    exporting,
    importDialogOpen,
    setImportDialogOpen,
    importFormat,
    setImportFormat,
    importMode,
    setImportMode,
    pendingData,
    csvPending,
    zipPending,
    importing,
    importPreview: dryRunPreview,
    handleExport,
    handleImportFileClick,
    handleImportFileSelected,
    handleConfirmImport,
    resetImportState,
  } = actions;

  const { locations } = useLocationList();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(activeLocationId ?? null);

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const selectedLocationName = selectedLocation?.name ?? 'Current location';

  const hasImportFile = (importFormat === 'zip' && zipPending != null) || (importFormat === 'json' && pendingData != null) || (importFormat === 'csv' && csvPending != null);

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const importSummary =
    dryRunPreview
      ? null
      : importFormat === 'zip' && zipPending
        ? `${zipPending.file.name} (${formatFileSize(zipPending.file.size)})`
        : importFormat === 'json' && pendingData
          ? `Found ${pendingData.bins.length} bin${pendingData.bins.length !== 1 ? 's' : ''}`
          : importFormat === 'csv' && csvPending
            ? `Found ${csvPending.bins} bin${csvPending.bins !== 1 ? 's' : ''} with ${csvPending.items} item${csvPending.items !== 1 ? 's' : ''}`
            : null;

  return (
    <>
      <SettingsPageHeader title="Data" description="Export, import, and manage your data." />

      <SettingsSection label="Navigation">
        <SettingsRow
          icon={Clock}
          label="Activity Log"
          description="View changes and actions"
          onClick={() => navigate('/settings/activity')}
        />
        <SettingsRow
          icon={Trash2}
          label="Trash"
          description="Recover or remove deleted bins"
          onClick={() => navigate('/settings/trash')}
        />
      </SettingsSection>

      <SettingsSection label="Export & Import">
        <SettingsRow
          icon={Download}
          label="Export Data"
          description="Backup or download your data"
          onClick={() => { setSelectedLocationId(activeLocationId ?? null); if (exportGated) setExportFormat('csv'); setExportDialogOpen(true); }}
          disabled={!activeLocationId}
        />
        <SettingsRow
          icon={Upload}
          label="Import Data"
          description="Import from backup or spreadsheet"
          onClick={() => {
            resetImportState();
            setSelectedLocationId(activeLocationId ?? null);
            setImportDialogOpen(true);
          }}
          disabled={!activeLocationId}
        />
      </SettingsSection>

      <input
        ref={fileInputRef}
        type="file"
        accept={importFormat === 'zip' ? '.zip,application/zip' : importFormat === 'csv' ? '.csv,text/csv' : '.json'}
        className="hidden"
        onChange={(e) => handleImportFileSelected(e.target.files, selectedLocationId)}
      />

      <Dialog open={exportDialogOpen} onOpenChange={(open) => {
        if (!open && !exporting) setExportDialogOpen(false);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <LocationPickerSection locations={locations} value={selectedLocationId} onChange={setSelectedLocationId} />
            <div className="space-y-2.5">
              <span id="export-format-label" className="text-[13px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Format</span>
              <div className="flex flex-col gap-3" role="radiogroup" aria-labelledby="export-format-label">
                <label className={cn('flex items-start gap-2 text-sm', exportGated ? 'opacity-50 pointer-events-none' : 'cursor-pointer')}>
                  <input
                    type="radio"
                    name="export-format"
                    checked={exportFormat === 'zip'}
                    onChange={() => setExportFormat('zip')}
                    disabled={exportGated}
                    className="accent-[var(--accent)] mt-0.5"
                  />
                  <div>
                    <span className="text-[var(--text-primary)]">
                      Backup (ZIP)
                      {exportGated && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-[var(--radius-xs)] bg-[var(--bg-input)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-tertiary)]">
                          <Lock className="h-2.5 w-2.5" />
                          Pro
                        </span>
                      )}
                    </span>
                    <p className="text-[13px] text-[var(--text-tertiary)]">All data including photos</p>
                  </div>
                </label>
                <label className={cn('flex items-start gap-2 text-sm', exportGated ? 'opacity-50 pointer-events-none' : 'cursor-pointer')}>
                  <input
                    type="radio"
                    name="export-format"
                    checked={exportFormat === 'json'}
                    onChange={() => setExportFormat('json')}
                    disabled={exportGated}
                    className="accent-[var(--accent)] mt-0.5"
                  />
                  <div>
                    <span className="text-[var(--text-primary)]">
                      Backup (JSON)
                      {exportGated && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-[var(--radius-xs)] bg-[var(--bg-input)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-tertiary)]">
                          <Lock className="h-2.5 w-2.5" />
                          Pro
                        </span>
                      )}
                    </span>
                    <p className="text-[13px] text-[var(--text-tertiary)]">Data and settings, no photos</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="export-format"
                    checked={exportFormat === 'csv' || exportGated}
                    onChange={() => setExportFormat('csv')}
                    className="accent-[var(--accent)] mt-0.5"
                  />
                  <div>
                    <span className="text-[var(--text-primary)]">Spreadsheet (CSV)</span>
                    <p className="text-[13px] text-[var(--text-tertiary)]">Open in Excel or Google Sheets</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportDialogOpen(false)} disabled={exporting}>
              Cancel
            </Button>
            <Button onClick={() => handleExport(selectedLocationId)} disabled={exporting}>
              {exporting ? 'Exporting...' : `Export ${selectedLocationName}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        if (!open && !importing) {
          setImportDialogOpen(false);
          resetImportState();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <LocationPickerSection locations={locations} value={selectedLocationId} onChange={setSelectedLocationId} />
            <div className="space-y-2.5">
              <span id="import-format-label" className="text-[13px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">1. Format</span>
              <div className="flex flex-col gap-3" role="radiogroup" aria-labelledby="import-format-label">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="import-format"
                    checked={importFormat === 'zip'}
                    onChange={() => setImportFormat('zip')}
                    className="accent-[var(--accent)] mt-0.5"
                  />
                  <div>
                    <span className="text-[var(--text-primary)]">Backup (ZIP)</span>
                    <p className="text-[13px] text-[var(--text-tertiary)]">All data including photos</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="import-format"
                    checked={importFormat === 'json'}
                    onChange={() => setImportFormat('json')}
                    className="accent-[var(--accent)] mt-0.5"
                  />
                  <div>
                    <span className="text-[var(--text-primary)]">Backup (JSON)</span>
                    <p className="text-[13px] text-[var(--text-tertiary)]">Data and settings, no photos</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="import-format"
                    checked={importFormat === 'csv'}
                    onChange={() => setImportFormat('csv')}
                    className="accent-[var(--accent)] mt-0.5"
                  />
                  <div>
                    <span className="text-[var(--text-primary)]">Spreadsheet (CSV)</span>
                    <p className="text-[13px] text-[var(--text-tertiary)]">Bins and items from a spreadsheet</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-2.5">
              <span id="import-mode-label" className="text-[13px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">2. Mode</span>
              <div className="flex flex-col gap-3" role="radiogroup" aria-labelledby="import-mode-label">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="accent-[var(--accent)] mt-0.5"
                  />
                  <div>
                    <span className="text-[var(--text-primary)]">Merge</span>
                    <p className="text-[13px] text-[var(--text-tertiary)]">Add new data, skip existing</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="accent-[var(--accent)] mt-0.5"
                  />
                  <div>
                    <span className="text-[var(--text-primary)]">Replace</span>
                    <p className={cn('text-[13px]', importMode === 'replace' ? 'text-[var(--destructive)]' : 'text-[var(--text-tertiary)]')}>
                      Delete all existing data first
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">3. File</span>
              <Button variant="outline" onClick={handleImportFileClick} disabled={importing}>
                {hasImportFile ? 'Change File' : 'Select File'}
              </Button>
              {dryRunPreview && (
                <div className="max-h-48 overflow-y-auto space-y-1 text-[13px]">
                  {dryRunPreview.toCreate.map((b) => (
                    <div key={b.name} className="flex items-center gap-2 px-2 py-1 rounded-[var(--radius-xs)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] shrink-0" />
                      <span className="truncate flex-1">{b.name}</span>
                      <span className="text-[var(--text-tertiary)]">{b.itemCount} items</span>
                    </div>
                  ))}
                  {dryRunPreview.toSkip.map((b) => (
                    <div key={`skip-${b.name}`} className="flex items-center gap-2 px-2 py-1 rounded-[var(--radius-xs)] opacity-50">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-tertiary)] shrink-0" />
                      <span className="truncate flex-1">{b.name}</span>
                      <span className="text-[var(--text-tertiary)]">skip</span>
                    </div>
                  ))}
                </div>
              )}
              {importSummary && (
                <p className="text-[13px] text-[var(--text-secondary)]">{importSummary}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setImportDialogOpen(false);
                resetImportState();
              }}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button
              variant={importMode === 'replace' ? 'destructive' : 'default'}
              onClick={() => handleConfirmImport(selectedLocationId)}
              disabled={!hasImportFile || importing}
            >
              {importing ? 'Importing...' : importMode === 'replace' ? 'Replace & Import' : `Import ${selectedLocationName}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

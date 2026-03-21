import {
  ChevronRight,
  Clock,
  Compass,
  Database,
  Download,
  Trash2,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Disclosure } from '@/components/ui/disclosure';
import { cn } from '@/lib/utils';
import type { useDataSectionActions } from './useDataSectionActions';

interface DataSectionProps {
  activeLocationId: string | null | undefined;
  actions: ReturnType<typeof useDataSectionActions>;
  locationName?: string;
  binCount?: number;
  areaCount?: number;
  binLabel?: string;
  areaLabel?: string;
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-sm)] bg-[var(--bg-input)] overflow-hidden">
      {children}
    </div>
  );
}

function RowDivider() {
  return <div className="h-px mx-3.5 bg-[var(--border-subtle)]" />;
}

function SettingsRow({
  icon: Icon,
  label,
  description,
  onClick,
  disabled,
  loading,
  loadingLabel,
  destructive,
  chevron,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  destructive?: boolean;
  chevron?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn('flex items-center gap-3 px-3.5 py-3 hover:bg-[var(--bg-hover)] transition-colors w-full text-left disabled:opacity-40 disabled:pointer-events-none', destructive && 'text-[var(--destructive)]')}
    >
      <Icon
        className={cn('h-[18px] w-[18px] shrink-0', destructive ? 'text-[var(--destructive)]' : 'text-[var(--text-tertiary)]')}
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn('text-[15px] font-medium leading-snug', destructive ? 'text-[var(--destructive)]' : 'text-[var(--text-primary)]')}
        >
          {loading ? loadingLabel : label}
        </p>
        <p
          className={cn('text-[13px] leading-snug', destructive ? 'text-[var(--destructive)]/60' : 'text-[var(--text-tertiary)]')}
        >
          {description}
        </p>
      </div>
      {chevron && (
        <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
      )}
    </button>
  );
}

export function DataSection({
  activeLocationId,
  actions,
  locationName,
  binCount,
  areaCount,
  binLabel = 'bins',
  areaLabel = 'areas',
}: DataSectionProps) {
  const navigate = useNavigate();
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

  const statsText =
    binCount != null || areaCount != null
      ? [binCount != null ? `${binCount} ${binLabel}` : null, areaCount != null ? `${areaCount} ${areaLabel}` : null]
          .filter(Boolean)
          .join(' \u00b7 ')
      : undefined;

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
      <Card>
        <CardContent>
          <Disclosure label={<span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]"><Compass className="h-3.5 w-3.5" />Navigation</span>} labelClassName="text-[15px] font-semibold">
          <div className="mt-1">
            <RowGroup>
              <SettingsRow
                icon={Clock}
                label="Activity Log"
                description="View changes and actions"
                onClick={() => navigate('/activity')}
                chevron
              />
              <RowDivider />
              <SettingsRow
                icon={Trash2}
                label="Trash"
                description="Recover or remove deleted bins"
                onClick={() => navigate('/trash')}
                chevron
              />
            </RowGroup>
          </div>
          </Disclosure>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Disclosure label={<span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]"><Database className="h-3.5 w-3.5" />Data</span>} labelClassName="text-[15px] font-semibold">
          <div className="mt-1">
            <RowGroup>
              <SettingsRow
                icon={Download}
                label="Export Data"
                description="Backup or download your data"
                onClick={() => setExportDialogOpen(true)}
                disabled={!activeLocationId}
              />
              <RowDivider />
              <SettingsRow
                icon={Upload}
                label="Import Data"
                description="Import from backup or spreadsheet"
                onClick={() => {
                  resetImportState();
                  setImportDialogOpen(true);
                }}
                disabled={!activeLocationId}
              />
            </RowGroup>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={importFormat === 'zip' ? '.zip,application/zip' : importFormat === 'csv' ? '.csv,text/csv' : '.json'}
            className="hidden"
            onChange={(e) => handleImportFileSelected(e.target.files)}
          />
          </Disclosure>
        </CardContent>
      </Card>

      {/* Export dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={(open) => {
        if (!open && !exporting) setExportDialogOpen(false);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Data</DialogTitle>
            <DialogDescription>
              {locationName || 'Current location'}{statsText ? ` \u00b7 ${statsText}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="export-format"
                checked={exportFormat === 'zip'}
                onChange={() => setExportFormat('zip')}
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
                name="export-format"
                checked={exportFormat === 'json'}
                onChange={() => setExportFormat('json')}
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
                name="export-format"
                checked={exportFormat === 'csv'}
                onChange={() => setExportFormat('csv')}
                className="accent-[var(--accent)] mt-0.5"
              />
              <div>
                <span className="text-[var(--text-primary)]">Spreadsheet (CSV)</span>
                <p className="text-[13px] text-[var(--text-tertiary)]">Open in Excel or Google Sheets</p>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportDialogOpen(false)} disabled={exporting}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        if (!open && !importing) {
          setImportDialogOpen(false);
          resetImportState();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Data</DialogTitle>
            <DialogDescription>
              Import into {locationName || 'the current location'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2.5">
              <span className="text-[13px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Format</span>
              <div className="flex flex-col gap-3">
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
              <span className="text-[13px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Mode</span>
              <div className="flex flex-col gap-3">
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
              onClick={handleConfirmImport}
              disabled={!hasImportFile || importing}
            >
              {importing ? 'Importing...' : importMode === 'replace' ? 'Replace & Import' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

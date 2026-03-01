import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Download,
  FileArchive,
  FileSpreadsheet,
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
import { Label } from '@/components/ui/label';
import type { useDataSectionActions } from './useDataSectionActions';

interface DataSectionProps {
  activeLocationId: string | null | undefined;
  actions: ReturnType<typeof useDataSectionActions>;
  binCount?: number;
  areaCount?: number;
  binLabel?: string;
  areaLabel?: string;
}

function SectionLabel({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mt-5 mb-2">
      <span className="text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
        {children}
      </span>
      {trailing && (
        <span className="text-[12px] text-[var(--text-tertiary)]">{trailing}</span>
      )}
    </div>
  );
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
      className={`flex items-center gap-3 px-3.5 py-3 hover:bg-[var(--bg-hover)] transition-colors w-full text-left disabled:opacity-40 disabled:pointer-events-none ${destructive ? 'text-[var(--destructive)]' : ''}`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 ${
          destructive ? 'text-[var(--destructive)]' : 'text-[var(--text-tertiary)]'
        }`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-[15px] font-medium leading-snug ${
            destructive ? 'text-[var(--destructive)]' : 'text-[var(--text-primary)]'
          }`}
        >
          {loading ? loadingLabel : label}
        </p>
        <p
          className={`text-[13px] leading-snug ${
            destructive ? 'text-[var(--destructive)]/60' : 'text-[var(--text-tertiary)]'
          }`}
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
  binCount,
  areaCount,
  binLabel = 'bins',
  areaLabel = 'areas',
}: DataSectionProps) {
  const navigate = useNavigate();
  const {
    fileInputRef,
    replaceInputRef,
    exporting,
    exportingZip,
    exportingCsv,
    confirmReplace,
    setConfirmReplace,
    setPendingData,
    handleExport,
    handleExportZip,
    handleExportCsv,
    handleImportClick,
    handleFileSelected,
    handleReplaceFileSelected,
    handleReplaceImport,
  } = actions;

  const statsText =
    binCount != null || areaCount != null
      ? [binCount != null ? `${binCount} ${binLabel}` : null, areaCount != null ? `${areaCount} ${areaLabel}` : null]
          .filter(Boolean)
          .join(' \u00b7 ')
      : undefined;

  return (
    <>
      <Card>
        <CardContent>
          <Label>Data</Label>

          {/* Navigation */}
          <SectionLabel>Navigation</SectionLabel>
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
              description="Restore or permanently delete"
              onClick={() => navigate('/trash')}
              chevron
            />
          </RowGroup>

          {/* Export */}
          <SectionLabel trailing={statsText}>Export</SectionLabel>
          <RowGroup>
            <SettingsRow
              icon={FileArchive}
              label="Backup (ZIP)"
              description="All data including photos"
              onClick={handleExportZip}
              disabled={!activeLocationId}
              loading={exportingZip}
              loadingLabel="Exporting..."
            />
            <RowDivider />
            <SettingsRow
              icon={Download}
              label="Backup (JSON)"
              description="Data without photos"
              onClick={handleExport}
              disabled={!activeLocationId}
              loading={exporting}
              loadingLabel="Exporting..."
            />
            <RowDivider />
            <SettingsRow
              icon={FileSpreadsheet}
              label="Spreadsheet (CSV)"
              description="Flat table for spreadsheets"
              onClick={handleExportCsv}
              disabled={!activeLocationId}
              loading={exportingCsv}
              loadingLabel="Exporting..."
            />
          </RowGroup>

          {/* Import */}
          <SectionLabel>Import</SectionLabel>
          <RowGroup>
            <SettingsRow
              icon={Upload}
              label="Import Backup"
              description="Merge with existing data"
              onClick={handleImportClick}
              disabled={!activeLocationId}
            />
            <RowDivider />
            <SettingsRow
              icon={AlertTriangle}
              label="Replace All Data"
              description="Deletes everything, then imports from file"
              onClick={() => replaceInputRef.current?.click()}
              disabled={!activeLocationId}
              destructive
            />
          </RowGroup>

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
    </>
  );
}

import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Database,
  Download,
  FileArchive,
  FileSpreadsheet,
  Trash2,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { useDataSectionActions } from './useDataSectionActions';
import { DRAWER_PLACEMENT } from '@/components/ui/provider'
import { Button, Drawer } from '@chakra-ui/react'


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
      <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {children}
      </span>
      {trailing && (
        <span className="text-[12px] text-gray-500 dark:text-gray-400">{trailing}</span>
      )}
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-sm)] bg-gray-500/12 dark:bg-gray-500/24 overflow-hidden">
      {children}
    </div>
  );
}

function RowDivider() {
  return <div className="h-px mx-3.5 bg-black/6 dark:bg-white/6" />;
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
      className={`flex items-center gap-3 px-3.5 py-3 hover:bg-gray-500/8 dark:hover:bg-gray-500/18 transition-colors w-full text-left disabled:opacity-40 disabled:pointer-events-none ${destructive ? 'text-red-500 dark:text-red-400' : ''}`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 ${
          destructive ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
        }`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-[15px] font-medium leading-snug ${
            destructive ? 'text-red-500 dark:text-red-400' : ''
          }`}
        >
          {loading ? loadingLabel : label}
        </p>
        <p
          className={`text-[13px] leading-snug ${
            destructive ? 'text-red-500/60 dark:text-red-400/60' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {description}
        </p>
      </div>
      {chevron && (
        <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
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
          <Label className="inline-flex items-center gap-1.5"><Database className="h-3.5 w-3.5" />Data</Label>

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
      <Drawer.Root role="alertdialog" placement={DRAWER_PLACEMENT} open={confirmReplace} onOpenChange={(e) => setConfirmReplace(e.open)}>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Title>Replace All Data?</Drawer.Title>
              <Drawer.Description>
                This will delete all existing bins and photos in the current location, then import from the backup file. This action cannot be undone.
              </Drawer.Description>
            </Drawer.Header>
            <Drawer.Body />
            <Drawer.Footer>
              <Button
                width="full"
                variant="ghost"
                onClick={() => {
                  setConfirmReplace(false);
                  setPendingData(null);
                }}
              >
                Cancel
              </Button>
              <Button
                width="full"
                onClick={handleReplaceImport}
                className="bg-red-500 hover:opacity-90"
              >
                Replace All
              </Button>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </>
  );
}

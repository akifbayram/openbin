import { useNavigate } from 'react-router-dom';
import { Download, Upload, AlertTriangle, Clock, Trash2, FileArchive, FileSpreadsheet } from 'lucide-react';
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
import type { useDataSectionActions } from './useDataSectionActions';

interface DataSectionProps {
  activeLocationId: string | null | undefined;
  actions: ReturnType<typeof useDataSectionActions>;
}

export function DataSection({ activeLocationId, actions }: DataSectionProps) {
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

  return (
    <>
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

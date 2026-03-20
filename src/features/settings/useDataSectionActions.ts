import { useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import type { ExportData } from '@/types';
import {
  countCSVBins,
  downloadExport,
  exportAllData,
  exportCsv,
  exportZip,
  ImportError,
  importCSV,
  importData,
  importZip,
  parseImportFile,
  validateCSVHeader,
} from './exportImport';

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

export type ExportFormat = 'zip' | 'json' | 'csv';
export type ImportFormat = 'zip' | 'json' | 'csv';

export function useDataSectionActions() {
  const { activeLocationId } = useAuth();
  const { showToast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('zip');
  const [exporting, setExporting] = useState(false);

  // Import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFormatRaw, setImportFormatRaw] = useState<ImportFormat>('json');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [pendingData, setPendingData] = useState<ExportData | null>(null);
  const [csvPending, setCsvPending] = useState<{ file: File; bins: number; items: number } | null>(null);
  const [zipPending, setZipPending] = useState<{ file: File } | null>(null);
  const [importing, setImporting] = useState(false);

  function setImportFormat(format: ImportFormat) {
    setImportFormatRaw(format);
    setPendingData(null);
    setCsvPending(null);
    setZipPending(null);
  }

  function resetImportState() {
    setPendingData(null);
    setCsvPending(null);
    setZipPending(null);
    setImportFormatRaw('zip');
    setImportMode('merge');
  }

  // --- Export ---

  async function handleExport() {
    if (!activeLocationId) {
      showToast({ message: 'Select a location first' });
      return;
    }
    setExporting(true);
    try {
      switch (exportFormat) {
        case 'zip':
          await exportZip(activeLocationId);
          showToast({ message: 'ZIP backup exported successfully' });
          break;
        case 'json': {
          const data = await exportAllData(activeLocationId);
          downloadExport(data);
          showToast({ message: 'Backup exported successfully' });
          break;
        }
        case 'csv':
          await exportCsv(activeLocationId);
          showToast({ message: 'CSV exported successfully' });
          break;
      }
      setExportDialogOpen(false);
    } catch {
      const label = exportFormat === 'zip' ? 'ZIP export' : exportFormat === 'csv' ? 'CSV export' : 'Export';
      showToast({ message: `${label} failed` });
    } finally {
      setExporting(false);
    }
  }

  // --- Import ---

  function handleImportFileClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFileSelected(files: FileList | null) {
    if (!files?.[0] || !activeLocationId) return;
    const file = files[0];

    if (importFormatRaw === 'zip') {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        showToast({ message: 'Please select a .zip file' });
      } else {
        setZipPending({ file });
      }
    } else if (importFormatRaw === 'json') {
      try {
        const data = await parseImportFile(file);
        setPendingData(data);
      } catch (err) {
        showToast({ message: importErrorMessage(err) });
      }
    } else {
      try {
        const text = await file.text();
        if (!text.trim()) {
          showToast({ message: 'CSV file is empty' });
          return;
        }
        if (!validateCSVHeader(text)) {
          showToast({ message: 'Invalid CSV header. Expected "Bin Name,Area,Item,Quantity,Tags" or "Bin Name,Area,Items,Tags"' });
          return;
        }
        const counts = countCSVBins(text);
        setCsvPending({ file, bins: counts.bins, items: counts.items });
      } catch {
        showToast({ message: 'Failed to read CSV file' });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleConfirmImport() {
    if (!activeLocationId) return;

    if (importFormatRaw === 'zip' && zipPending) {
      setImporting(true);
      try {
        const result = await importZip(activeLocationId, zipPending.file, importMode);
        if (importMode === 'replace') {
          showToast({
            message: `Replaced all data: ${result.binsImported} bin${result.binsImported !== 1 ? 's' : ''}${result.photosImported ? `, ${result.photosImported} photo${result.photosImported !== 1 ? 's' : ''}` : ''}`,
          });
        } else {
          showToast({
            message: `Imported ${result.binsImported} bin${result.binsImported !== 1 ? 's' : ''}${result.photosImported ? `, ${result.photosImported} photo${result.photosImported !== 1 ? 's' : ''}` : ''}${result.binsSkipped ? ` (${result.binsSkipped} skipped)` : ''}`,
          });
        }
        setZipPending(null);
        setImportDialogOpen(false);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        showToast({ message: `ZIP import failed: ${detail}` });
      } finally {
        setImporting(false);
      }
    } else if (importFormatRaw === 'json' && pendingData) {
      setImporting(true);
      try {
        const result = await importData(activeLocationId, pendingData, importMode);
        if (importMode === 'replace') {
          showToast({
            message: `Replaced all data: ${result.binsImported} bin${result.binsImported !== 1 ? 's' : ''}${result.photosImported ? `, ${result.photosImported} photo${result.photosImported !== 1 ? 's' : ''}` : ''}`,
          });
        } else {
          showToast({
            message: `Imported ${result.binsImported} bin${result.binsImported !== 1 ? 's' : ''}${result.photosImported ? `, ${result.photosImported} photo${result.photosImported !== 1 ? 's' : ''}` : ''}${result.binsSkipped ? ` (${result.binsSkipped} skipped)` : ''}`,
          });
        }
        setPendingData(null);
        setImportDialogOpen(false);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        showToast({ message: `${importMode === 'replace' ? 'Replace import' : 'Import'} failed: ${detail}` });
      } finally {
        setImporting(false);
      }
    } else if (importFormatRaw === 'csv' && csvPending) {
      setImporting(true);
      try {
        const result = await importCSV(activeLocationId, csvPending.file, importMode);
        showToast({
          message: `Imported ${result.binsImported} bin${result.binsImported !== 1 ? 's' : ''} with ${result.itemsImported} item${result.itemsImported !== 1 ? 's' : ''}${result.binsSkipped ? ` (${result.binsSkipped} skipped)` : ''}`,
        });
        setCsvPending(null);
        setImportDialogOpen(false);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        showToast({ message: `CSV import failed: ${detail}` });
      } finally {
        setImporting(false);
      }
    }
  }

  return {
    fileInputRef,
    exportDialogOpen,
    setExportDialogOpen,
    exportFormat,
    setExportFormat,
    exporting,
    importDialogOpen,
    setImportDialogOpen,
    importFormat: importFormatRaw,
    setImportFormat,
    importMode,
    setImportMode,
    pendingData,
    csvPending,
    zipPending,
    importing,
    handleExport,
    handleImportFileClick,
    handleImportFileSelected,
    handleConfirmImport,
    resetImportState,
  };
}

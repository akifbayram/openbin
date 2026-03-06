import { useRef, useState } from 'react';
import { toaster } from '@/components/ui/toaster';
import { useAuth } from '@/lib/auth';
import type { ExportData } from '@/types';
import {
  downloadExport,
  exportAllData,
  exportCsv,
  exportZip,
  ImportError,
  importData,
  parseImportFile,
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

export function useDataSectionActions() {
  const { activeLocationId } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingData, setPendingData] = useState<ExportData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  async function handleExport() {
    if (!activeLocationId) {
      toaster.create({ description: 'Select a location first' });
      return;
    }
    setExporting(true);
    try {
      const data = await exportAllData(activeLocationId);
      downloadExport(data);
      toaster.create({ description: 'Backup exported successfully' });
    } catch {
      toaster.create({ description: 'Export failed' });
    } finally {
      setExporting(false);
    }
  }

  async function handleExportZip() {
    if (!activeLocationId) {
      toaster.create({ description: 'Select a location first' });
      return;
    }
    setExportingZip(true);
    try {
      await exportZip(activeLocationId);
      toaster.create({ description: 'ZIP backup exported successfully' });
    } catch {
      toaster.create({ description: 'ZIP export failed' });
    } finally {
      setExportingZip(false);
    }
  }

  async function handleExportCsv() {
    if (!activeLocationId) {
      toaster.create({ description: 'Select a location first' });
      return;
    }
    setExportingCsv(true);
    try {
      await exportCsv(activeLocationId);
      toaster.create({ description: 'CSV exported successfully' });
    } catch {
      toaster.create({ description: 'CSV export failed' });
    } finally {
      setExportingCsv(false);
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(files: FileList | null) {
    if (!files?.[0] || !activeLocationId) return;
    try {
      const data = await parseImportFile(files[0]);
      setPendingData(data);
      const result = await importData(activeLocationId, data, 'merge');
      toaster.create({
        description: `Imported ${result.binsImported} bin${result.binsImported !== 1 ? 's' : ''}${result.photosImported ? `, ${result.photosImported} photo${result.photosImported !== 1 ? 's' : ''}` : ''}${result.binsSkipped ? ` (${result.binsSkipped} skipped)` : ''}`,
      });
      setPendingData(null);
    } catch (err) {
      toaster.create({ description: importErrorMessage(err) });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleReplaceImport() {
    if (!pendingData || !activeLocationId) return;
    try {
      const result = await importData(activeLocationId, pendingData, 'replace');
      toaster.create({
        description: `Replaced all data: ${result.binsImported} bin${result.binsImported !== 1 ? 's' : ''}${result.photosImported ? `, ${result.photosImported} photo${result.photosImported !== 1 ? 's' : ''}` : ''}`,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toaster.create({ description: `Replace import failed: ${detail}` });
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
      toaster.create({ description: importErrorMessage(err) });
    }
    if (replaceInputRef.current) replaceInputRef.current.value = '';
  }

  return {
    fileInputRef,
    replaceInputRef,
    exporting,
    exportingZip,
    exportingCsv,
    confirmReplace,
    setConfirmReplace,
    pendingData,
    setPendingData,
    handleExport,
    handleExportZip,
    handleExportCsv,
    handleImportClick,
    handleFileSelected,
    handleReplaceImport,
    handleReplaceFileSelected,
  };
}

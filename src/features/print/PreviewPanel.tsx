import { ChevronLeft, ChevronRight, Download, FileText, Printer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types';
import { ItemSheet } from './ItemSheet';
import { LabelSheet } from './LabelSheet';
import { computeLabelsPerPage, computePageSize, DEFAULT_LABEL_FORMAT, getLabelFormat } from './labelFormats';
import { NameSheet } from './NameSheet';
import type { PrintMode } from './usePrintSettings';

interface PreviewPanelProps {
  selectedBins: Bin[];
  pdfLoading: boolean;
  onDownloadPDF: () => void;
  labelSheetProps: React.ComponentProps<typeof LabelSheet>;
  printMode: PrintMode;
  itemSheetProps: React.ComponentProps<typeof ItemSheet>;
  nameSheetProps: React.ComponentProps<typeof NameSheet>;
}

export function PreviewPanel({ selectedBins, pdfLoading, onDownloadPDF, labelSheetProps, printMode, itemSheetProps, nameSheetProps }: PreviewPanelProps) {
  const t = useTerminology();
  const hasSelection = selectedBins.length > 0;
  const noun = printMode === 'items' ? 'List' : printMode === 'names' ? 'Name' : 'Label';
  const printLabel = selectedBins.length !== 1 ? `${noun}s` : noun;

  const effectiveFormat = printMode === 'names'
    ? nameSheetProps.format
    : (labelSheetProps.format ?? getLabelFormat(DEFAULT_LABEL_FORMAT));

  const perPage = (printMode === 'labels' || printMode === 'names')
    ? computeLabelsPerPage(effectiveFormat)
    : 0;
  const pageCount = perPage > 0 && hasSelection ? Math.ceil(selectedBins.length / perPage) : 0;

  const [currentPage, setCurrentPage] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset page when count changes
  useEffect(() => { setCurrentPage(0); }, [pageCount]);
  const safePage = Math.min(currentPage, Math.max(0, pageCount - 1));
  const canPrev = safePage > 0;
  const canNext = safePage < pageCount - 1;

  // Slice bins for current preview page
  const previewBins = useMemo(() => {
    if (printMode === 'items' || perPage <= 0) return selectedBins;
    const start = safePage * perPage;
    return selectedBins.slice(start, start + perPage);
  }, [selectedBins, safePage, perPage, printMode]);

  const previewRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const pageSize = printMode !== 'items' ? computePageSize(effectiveFormat) : null;
  const pageWidthPx = pageSize ? pageSize.width * 96 : 0;
  const pageHeightPx = pageSize ? pageSize.height * 96 : 0;

  useEffect(() => {
    const el = previewRef.current;
    if (!el || !pageWidthPx) {
      setScale(1);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setScale(w > 0 && w < pageWidthPx ? w / pageWidthPx : 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageWidthPx]);

  const pageCountLabel = pageCount > 0 ? ` (${pageCount} ${pageCount !== 1 ? 'pages' : 'page'})` : '';

  return (
    <>
      <div className="flex gap-2" data-tour="print-preview">
        <Button
          onClick={() => window.print()}
          disabled={!hasSelection}
          className="flex-1 rounded-[var(--radius-md)] h-12 text-[17px]"
        >
          <Printer className="h-5 w-5 mr-2.5" />
          {hasSelection
            ? `Print ${selectedBins.length} ${printLabel}${pageCountLabel}`
            : 'Print'}
        </Button>
        {(printMode === 'labels' || printMode === 'names') && (
          <Button
            variant="outline"
            onClick={onDownloadPDF}
            disabled={!hasSelection || pdfLoading}
            className="rounded-[var(--radius-md)] h-12 px-4 text-[15px]"
          >
            <Download className={cn('h-5 w-5 mr-1.5', pdfLoading && 'animate-pulse')} />
            PDF
          </Button>
        )}
      </div>

      {hasSelection ? (
        <Card>
          <CardContent>
            <div className="row-spread mb-3">
              <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal">Preview</Label>
              {pageCount > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(safePage - 1)}
                    disabled={!canPrev}
                    aria-label="Previous page"
                    className={cn(
                      'p-1 rounded-[var(--radius-xs)] transition-colors',
                      canPrev ? 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)] opacity-40',
                    )}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums min-w-[4.5rem] text-center">
                    Page {safePage + 1} of {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(safePage + 1)}
                    disabled={!canNext}
                    aria-label="Next page"
                    className={cn(
                      'p-1 rounded-[var(--radius-xs)] transition-colors',
                      canNext ? 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)] opacity-40',
                    )}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
              {pageCount === 1 && (
                <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums">1 page</span>
              )}
            </div>
            <div ref={previewRef} className="bg-[var(--bg-print-surface)] rounded-[var(--radius-md)] px-4 py-6 overflow-hidden shadow-[inset_0_0_0_1px_var(--border-preview)]">
              {printMode === 'items' ? (
                <ItemSheet {...itemSheetProps} />
              ) : (
                <div
                  style={scale < 1 ? {
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    height: `${pageHeightPx * scale}px`,
                  } : undefined}
                >
                  {printMode === 'names' ? (
                    <NameSheet {...nameSheetProps} bins={previewBins} />
                  ) : (
                    <LabelSheet {...labelSheetProps} bins={previewBins} />
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border-subtle)]">
          <div className="rounded-[var(--radius-xl)] bg-[var(--bg-input)] p-3.5 mb-4">
            <FileText className="h-6 w-6 text-[var(--text-tertiary)]" />
          </div>
          <p className="text-[15px] font-medium text-[var(--text-secondary)] mb-1">No {t.bins} selected</p>
          <p className="text-[13px] text-[var(--text-tertiary)]">Choose {t.bins} to preview and print labels</p>
        </div>
      )}
    </>
  );
}

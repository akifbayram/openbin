import { Download, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types';
import { ItemSheet } from './ItemSheet';
import { LabelSheet } from './LabelSheet';
import { computeLabelsPerPage, DEFAULT_LABEL_FORMAT, getLabelFormat } from './labelFormats';
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
  const pageCount = (printMode === 'labels' || printMode === 'names') && hasSelection
    ? Math.ceil(selectedBins.length / computeLabelsPerPage(labelSheetProps.format ?? getLabelFormat(DEFAULT_LABEL_FORMAT)))
    : 0;

  return (
    <>
      <div className="flex gap-2">
        <Button
          onClick={() => window.print()}
          disabled={!hasSelection}
          className="flex-1 rounded-[var(--radius-md)] h-12 text-[17px]"
        >
          <Printer className="h-5 w-5 mr-2.5" />
          {hasSelection ? `Print ${selectedBins.length} ${printLabel}` : 'Print'}
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
              {(printMode === 'labels' || printMode === 'names') && (
                <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums">
                  {pageCount} {pageCount !== 1 ? 'pages' : 'page'}
                </span>
              )}
            </div>
            <div className="bg-[var(--bg-print-surface)] rounded-[var(--radius-md)] p-4 max-h-[50vh] lg:max-h-[70vh] overflow-y-auto shadow-[inset_0_0_0_1px_var(--border-preview)]">
              {printMode === 'items' ? (
                <ItemSheet {...itemSheetProps} />
              ) : printMode === 'names' ? (
                <NameSheet {...nameSheetProps} />
              ) : (
                <LabelSheet {...labelSheetProps} />
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="hidden lg:block">
          <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border-subtle)]">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-[var(--bg-input)] p-3.5 mb-4">
                <FileText className="h-6 w-6 text-[var(--text-tertiary)]" />
              </div>
              <p className="text-[15px] font-medium text-[var(--text-secondary)] mb-1">No {t.bins} selected</p>
              <p className="text-[13px] text-[var(--text-tertiary)]">Choose {t.bins} to preview and print labels</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { Printer, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/lib/terminology';
import { LabelSheet } from './LabelSheet';
import { computeLabelsPerPage, getLabelFormat, DEFAULT_LABEL_FORMAT } from './labelFormats';
import type { Bin } from '@/types';

interface PreviewPanelProps {
  selectedBins: Bin[];
  pdfLoading: boolean;
  onDownloadPDF: () => void;
  labelSheetProps: React.ComponentProps<typeof LabelSheet>;
}

export function PreviewPanel({ selectedBins, pdfLoading, onDownloadPDF, labelSheetProps }: PreviewPanelProps) {
  const t = useTerminology();

  if (selectedBins.length > 0) {
    const format = labelSheetProps.format ?? getLabelFormat(DEFAULT_LABEL_FORMAT);
    const perPage = computeLabelsPerPage(format);
    const pageCount = Math.ceil(selectedBins.length / perPage);

    return (
      <>
        <div className="flex gap-2">
          <Button
            onClick={() => window.print()}
            className="flex-1 rounded-[var(--radius-md)] h-12 text-[17px] shadow-[0_2px_12px_var(--accent-glow)]"
          >
            <Printer className="h-5 w-5 mr-2.5" />
            Print {selectedBins.length} {selectedBins.length !== 1 ? 'Labels' : 'Label'}
          </Button>
          <Button
            variant="outline"
            onClick={onDownloadPDF}
            disabled={pdfLoading}
            className="rounded-[var(--radius-md)] h-12 px-4 text-[15px]"
          >
            <Download className={cn('h-5 w-5 mr-1.5', pdfLoading && 'animate-pulse')} />
            PDF
          </Button>
        </div>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal">Preview</Label>
              <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums">
                {pageCount} {pageCount !== 1 ? 'pages' : 'page'}
              </span>
            </div>
            <div className="bg-white rounded-[var(--radius-md)] p-4 max-h-[50vh] lg:max-h-[70vh] overflow-y-auto shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <LabelSheet {...labelSheetProps} />
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
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
  );
}

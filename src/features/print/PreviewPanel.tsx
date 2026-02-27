import { Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/lib/terminology';
import { LabelSheet } from './LabelSheet';
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
    return (
      <>
        <div className="flex gap-2">
          <Button
            onClick={() => window.print()}
            className="flex-1 rounded-[var(--radius-md)] h-12 text-[17px]"
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
            <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal mb-3 block">Preview</Label>
            <div className="bg-white rounded-[var(--radius-md)] p-4 max-h-[50vh] lg:max-h-[70vh] overflow-y-auto dark:border dark:border-[var(--border-subtle)]">
              <LabelSheet {...labelSheetProps} />
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <div className="hidden lg:block">
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Printer className="h-10 w-10 text-[var(--text-tertiary)] mb-3 opacity-40" />
            <p className="text-[15px] font-medium text-[var(--text-secondary)] mb-1">No {t.bins} selected</p>
            <p className="text-[13px] text-[var(--text-tertiary)]">Select {t.bins} to preview and print labels</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

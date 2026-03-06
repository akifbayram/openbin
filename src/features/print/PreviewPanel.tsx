import { Download, FileText, Printer } from 'lucide-react';
import { Button } from '@chakra-ui/react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types';
import { LabelSheet } from './LabelSheet';
import { computeLabelsPerPage, DEFAULT_LABEL_FORMAT, getLabelFormat } from './labelFormats';

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
            className="flex-1 rounded-[var(--radius-md)] h-12 text-[17px] shadow-[0_2px_12px_rgba(147,51,234,0.3)] dark:shadow-[0_2px_12px_rgba(168,85,247,0.4)]"
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
              <Label className="text-[15px] font-semibold normal-case tracking-normal">Preview</Label>
              <span className="text-[12px] text-gray-500 dark:text-gray-400 tabular-nums">
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
      <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-black/6 dark:border-white/6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-500/12 dark:bg-gray-500/24 p-3.5 mb-4">
            <FileText className="h-6 w-6 text-gray-500 dark:text-gray-400" />
          </div>
          <p className="text-[15px] font-medium text-gray-600 dark:text-gray-300 mb-1">No {t.bins} selected</p>
          <p className="text-[13px] text-gray-500 dark:text-gray-400">Choose {t.bins} to preview and print labels</p>
        </div>
      </div>
    </div>
  );
}

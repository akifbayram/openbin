import './print.css';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { MenuButton } from '@/components/ui/menu-button';
import { LabelSheet } from './LabelSheet';
import { usePrintPageActions } from './usePrintPageActions';
import { BinSelectorCard } from './BinSelectorCard';
import { LabelFormatCard } from './LabelFormatCard';
import { LabelOptionsCard } from './LabelOptionsCard';
import { QrStyleCard } from './QrStyleCard';
import { PreviewPanel } from './PreviewPanel';

export function PrintPage() {
  const {
    allBins, areas, isLoading,
    selection,
    format,
    labelOptions, handleUpdateLabelOption,
    qrStyle, handleUpdateQrStyle,
    ui,
    pdfLoading, handleDownloadPDF,
    labelSheetProps,
  } = usePrintPageActions();

  if (isLoading) {
    return (
      <div className="page-content print-hide max-w-6xl">
        <div className="flex items-center gap-2 mb-4">
          <MenuButton />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-start gap-4">
          <div className="glass-card rounded-[var(--radius-lg)] p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3">
                <Skeleton className="h-[22px] w-[22px] rounded-full shrink-0" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
          <div className="hidden lg:block">
            <Skeleton className="h-64 w-full rounded-[var(--radius-lg)]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-content print-hide max-w-6xl">
        <PageHeader title="Print" className="mb-4" />

        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-start gap-4">
        {/* Left column — settings */}
        <div className="flex flex-col gap-4">
          <BinSelectorCard
            allBins={allBins}
            areas={areas}
            selectedIds={selection.selectedIds}
            toggleBin={selection.toggleBin}
            selectAll={selection.selectAll}
            selectNone={selection.selectNone}
            selectByArea={selection.selectByArea}
            expanded={ui.binsExpanded}
            onExpandedChange={ui.setBinsExpanded}
          />

          <LabelFormatCard
            format={format}
            expanded={ui.formatExpanded}
            onExpandedChange={ui.setFormatExpanded}
          />

          <LabelOptionsCard
            labelOptions={labelOptions}
            onUpdateOption={handleUpdateLabelOption}
            expanded={ui.optionsExpanded}
            onExpandedChange={ui.setOptionsExpanded}
          />

          <QrStyleCard
            qrStyle={qrStyle}
            onUpdateStyle={handleUpdateQrStyle}
            expanded={ui.qrStyleExpanded}
            onExpandedChange={ui.setQrStyleExpanded}
          />
        </div>

        {/* Right column — preview (sticky on desktop) */}
        <div className="lg:sticky lg:top-6 flex flex-col gap-4">
          <PreviewPanel
            selectedBins={selection.selectedBins}
            pdfLoading={pdfLoading}
            onDownloadPDF={handleDownloadPDF}
            labelSheetProps={labelSheetProps}
          />
        </div>
        </div>
      </div>

      <div className="print-show">
        <LabelSheet {...labelSheetProps} />
      </div>
    </>
  );
}

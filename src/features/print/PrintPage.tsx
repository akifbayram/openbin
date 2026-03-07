import './print.css';
import { List, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { MenuButton } from '@/components/ui/menu-button';
import { OptionGroup } from '@/components/ui/option-group';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { BinSelectorCard } from './BinSelectorCard';
import { ItemListOptionsCard } from './ItemListOptionsCard';
import { ItemSheet } from './ItemSheet';
import { LabelFormatCard } from './LabelFormatCard';
import { LabelOptionsCard } from './LabelOptionsCard';
import { LabelSheet } from './LabelSheet';
import { PreviewPanel } from './PreviewPanel';
import { QrStyleCard } from './QrStyleCard';
import { usePrintPageActions } from './usePrintPageActions';

export function PrintPage() {
  const {
    allBins, areas, isLoading,
    selection,
    format,
    labelOptions, handleUpdateLabelOption,
    qrStyle, handleUpdateQrStyle,
    printMode, handlePrintModeChange,
    itemListOptions, handleUpdateItemListOption,
    itemSheetProps,
    ui,
    pdfLoading, handleDownloadPDF,
    labelSheetProps,
  } = usePrintPageActions();

  if (isLoading) {
    return (
      <div className="page-content print-hide max-w-6xl">
        <div className="row mb-4">
          <MenuButton />
          <Skeleton className="h-9 w-16" />
        </div>
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-start gap-4">
          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent>
                  <div className="row">
                    <Skeleton className="h-4 w-4 rounded shrink-0" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="hidden lg:block">
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-content print-hide max-w-6xl">
        <PageHeader title="Print" back />

        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-start gap-4">
        {/* Left column — settings */}
        <div className="flex flex-col gap-4">
          <OptionGroup
            options={[
              { key: 'labels', label: 'Labels', icon: Tag },
              { key: 'items', label: 'Item List', icon: List },
            ]}
            value={printMode}
            onChange={handlePrintModeChange}
          />

          <BinSelectorCard
            allBins={allBins}
            areas={areas}
            selectedIds={selection.selectedIds}
            toggleBin={selection.toggleBin}
            selectAll={selection.selectAll}
            selectNone={selection.selectNone}
            toggleArea={selection.toggleArea}
            expanded={ui.binsExpanded}
            onExpandedChange={ui.setBinsExpanded}
          />

          {printMode === 'labels' && (
            <>
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
            </>
          )}

          {printMode === 'items' && (
            <ItemListOptionsCard
              options={itemListOptions}
              onUpdate={handleUpdateItemListOption}
              expanded={ui.itemListOptionsExpanded}
              onExpandedChange={ui.setItemListOptionsExpanded}
            />
          )}
        </div>

        {/* Right column — preview (sticky on desktop) */}
        <div className="lg:sticky lg:top-6 flex flex-col gap-4">
          <PreviewPanel
            selectedBins={selection.selectedBins}
            pdfLoading={pdfLoading}
            onDownloadPDF={handleDownloadPDF}
            labelSheetProps={labelSheetProps}
            printMode={printMode}
            itemSheetProps={itemSheetProps}
          />
        </div>
        </div>
      </div>

      <div className="print-show">
        {printMode === 'items' ? (
          <ItemSheet {...itemSheetProps} />
        ) : (
          <LabelSheet {...labelSheetProps} />
        )}
      </div>
    </>
  );
}

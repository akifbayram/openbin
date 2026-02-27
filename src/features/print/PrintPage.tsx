import './print.css';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { MenuButton } from '@/components/ui/menu-button';
import { LabelSheet } from './LabelSheet';
import { usePrintPageActions } from './usePrintPageActions';
import { BinSelectorCard } from './BinSelectorCard';
import { LabelFormatCard } from './LabelFormatCard';
import { LabelOptionsCard } from './LabelOptionsCard';
import { PreviewPanel } from './PreviewPanel';

export function PrintPage() {
  const {
    allBins,
    areas,
    isLoading,
    selectedIds,
    selectedBins,
    toggleBin,
    selectAll,
    selectNone,
    selectByArea,
    formatKey,
    baseFormat,
    effectiveOrientation,
    customState,
    displayUnit,
    savedPresets,
    formatSearch,
    setFormatSearch,
    handleFormatChange,
    toggleCustomize,
    updateOverride,
    getOverrideValue,
    toggleOrientation,
    updateDisplayUnit,
    presetName,
    setPresetName,
    showSaveInput,
    setShowSaveInput,
    handleSavePreset,
    handleDeletePreset,
    labelOptions,
    handleUpdateLabelOption,
    binsExpanded,
    setBinsExpanded,
    formatExpanded,
    setFormatExpanded,
    optionsExpanded,
    setOptionsExpanded,
    pdfLoading,
    handleDownloadPDF,
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
            selectedIds={selectedIds}
            toggleBin={toggleBin}
            selectAll={selectAll}
            selectNone={selectNone}
            selectByArea={selectByArea}
            expanded={binsExpanded}
            onExpandedChange={setBinsExpanded}
          />

          <LabelFormatCard
            formatKey={formatKey}
            baseFormat={baseFormat}
            effectiveOrientation={effectiveOrientation}
            customState={customState}
            displayUnit={displayUnit}
            savedPresets={savedPresets}
            formatSearch={formatSearch}
            setFormatSearch={setFormatSearch}
            handleFormatChange={handleFormatChange}
            toggleCustomize={toggleCustomize}
            updateOverride={updateOverride}
            getOverrideValue={getOverrideValue}
            toggleOrientation={toggleOrientation}
            updateDisplayUnit={updateDisplayUnit}
            presetName={presetName}
            setPresetName={setPresetName}
            showSaveInput={showSaveInput}
            setShowSaveInput={setShowSaveInput}
            handleSavePreset={handleSavePreset}
            handleDeletePreset={handleDeletePreset}
            expanded={formatExpanded}
            onExpandedChange={setFormatExpanded}
          />

          <LabelOptionsCard
            labelOptions={labelOptions}
            onUpdateOption={handleUpdateLabelOption}
            expanded={optionsExpanded}
            onExpandedChange={setOptionsExpanded}
          />
        </div>

        {/* Right column — preview (sticky on desktop) */}
        <div className="lg:sticky lg:top-6 flex flex-col gap-4">
          <PreviewPanel
            selectedBins={selectedBins}
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

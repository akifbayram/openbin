import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PhotoBulkAdd } from './PhotoBulkAdd';
import { AiSetupView } from './InlineAiSetup';
import { useNavigate } from 'react-router-dom';
import { useCommandInputState } from './useCommandInputState';
import { useActionExecutor } from './useActionExecutor';
import { InventoryQueryResult } from './InventoryQueryResult';
import { CommandActionPreview } from './CommandActionPreview';
import { CommandIdleInput } from './CommandIdleInput';

interface CommandInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandInput({ open, onOpenChange }: CommandInputProps) {
  const navigate = useNavigate();

  const {
    text, setText,
    checkedActions,
    queryResult,
    photoMode, setPhotoMode,
    initialFiles, setInitialFiles,
    examplesOpen, setExamplesOpen,
    fileInputRef,
    state, isAiReady, aiSettingsLoading, selectedCount,
    actions, interpretation, error,
    handleParse, handleBack, toggleAction,
    handleClose, handlePhotoSelect, handleBinClick,
    handleExecuteComplete,
  } = useCommandInputState(onOpenChange);

  const { isExecuting, executingProgress, executeActions } = useActionExecutor({
    actions,
    checkedActions,
    onComplete: handleExecuteComplete,
  });

  // Augment state with executor state
  const effectiveState = isExecuting ? 'executing' : state;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{photoMode ? 'Add from Photos' : 'Ask AI'}</DialogTitle>
        </DialogHeader>

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />

        {photoMode ? (
          <PhotoBulkAdd
            initialFiles={initialFiles}
            onClose={() => handleClose(false)}
            onBack={() => { setPhotoMode(false); setInitialFiles([]); }}
          />
        ) : effectiveState === 'querying' ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
            <p className="text-[14px] text-[var(--text-secondary)]">Searching your inventory...</p>
          </div>
        ) : effectiveState === 'query-result' && queryResult ? (
          <InventoryQueryResult
            queryResult={queryResult}
            onBinClick={handleBinClick}
            onBack={handleBack}
          />
        ) : effectiveState === 'preview' && actions ? (
          <CommandActionPreview
            actions={actions}
            interpretation={interpretation}
            checkedActions={checkedActions}
            toggleAction={toggleAction}
            selectedCount={selectedCount}
            isExecuting={isExecuting}
            executingProgress={executingProgress}
            onBack={handleBack}
            onExecute={executeActions}
          />
        ) : !aiSettingsLoading && !isAiReady ? (
          <AiSetupView onNavigate={() => { handleClose(false); navigate('/settings#ai-settings'); }} />
        ) : (
          <CommandIdleInput
            text={text}
            setText={setText}
            effectiveState={effectiveState}
            examplesOpen={examplesOpen}
            setExamplesOpen={setExamplesOpen}
            error={error}
            onParse={handleParse}
            onPhotoClick={() => fileInputRef.current?.click()}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

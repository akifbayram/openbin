import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@chakra-ui/react';
import { CommandActionPreview } from './CommandActionPreview';
import { CommandIdleInput } from './CommandIdleInput';
import { CommandSuccess } from './CommandSuccess';
import { AiSetupView } from './InlineAiSetup';
import { InventoryQueryResult } from './InventoryQueryResult';
import { PhotoBulkAdd } from './PhotoBulkAdd';
import { useActionExecutor } from './useActionExecutor';
import { useCommandInputState } from './useCommandInputState';

interface CommandInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoTriggerPhoto?: boolean;
}

export function CommandInput({ open, onOpenChange, autoTriggerPhoto }: CommandInputProps) {
  const navigate = useNavigate();

  const {
    text, setText,
    checkedActions,
    queryResult,
    queryPartialText,
    isQueryStreaming,
    photoMode, setPhotoMode,
    initialFiles, setInitialFiles,
    examplesOpen, setExamplesOpen,
    executionResult,
    fileInputRef,
    state, isAiReady, aiSettingsLoading, selectedCount,
    actions, interpretation, error,
    handleParse, handleBack, toggleAction,
    handleClose, handlePhotoSelect, handleBinClick,
    handleExecuteComplete, handleAskAnother,
  } = useCommandInputState(onOpenChange);

  const { isExecuting, executingProgress, executeActions } = useActionExecutor({
    actions,
    checkedActions,
    onComplete: handleExecuteComplete,
  });

  // Auto-trigger photo picker when opened via "Scan more"
  const autoTriggeredRef = useRef(false);
  useEffect(() => {
    if (open && autoTriggerPhoto && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      setTimeout(() => fileInputRef.current?.click(), 100);
    }
    if (!open) autoTriggeredRef.current = false;
  }, [open, autoTriggerPhoto]);

  // Augment state with executor state
  const effectiveState = isExecuting ? 'executing' : state;

  return (
    <Dialog.Root open={open} onOpenChange={(e) => handleClose(e.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>{photoMode ? 'Add from Photos' : 'Ask AI'}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />

            {photoMode ? (
              <div key="photo" className="ai-content-enter">
                <PhotoBulkAdd
                  initialFiles={initialFiles}
                  onClose={() => handleClose(false)}
                  onBack={() => { setPhotoMode(false); setInitialFiles([]); }}
                />
              </div>
            ) : effectiveState === 'success' && executionResult ? (
              <div key="success" className="ai-content-enter">
                <CommandSuccess
                  result={executionResult}
                  onAskAnother={handleAskAnother}
                  onClose={() => handleClose(false)}
                  onBinClick={handleBinClick}
                />
              </div>
            ) : effectiveState === 'query-result' ? (
              <div key="query-result" className="ai-content-enter">
                <InventoryQueryResult
                  queryResult={queryResult}
                  streamingText={queryPartialText}
                  isStreaming={isQueryStreaming}
                  onBinClick={handleBinClick}
                  onBack={handleBack}
                />
              </div>
            ) : effectiveState === 'preview' && actions ? (
              <div key="preview" className="ai-content-enter">
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
              </div>
            ) : !aiSettingsLoading && !isAiReady ? (
              <div key="setup" className="ai-content-enter">
                <AiSetupView onNavigate={() => { handleClose(false); navigate('/settings#ai-settings'); }} />
              </div>
            ) : (
              <div key="idle" className="ai-content-enter">
                <CommandIdleInput
                  text={text}
                  setText={setText}
                  isLoading={effectiveState === 'parsing' || effectiveState === 'querying' || effectiveState === 'executing'}
                  examplesOpen={examplesOpen}
                  setExamplesOpen={setExamplesOpen}
                  error={error}
                  onParse={handleParse}
                  onPhotoClick={() => fileInputRef.current?.click()}
                />
              </div>
            )}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AiProgressBar } from '@/components/ui/ai-progress-bar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { takeCapturedPhotos } from '@/features/capture/capturedPhotos';
import { isRecordingSupported } from '@/lib/audioRecorder';
import { useTerminology } from '@/lib/terminology';
import { useTranscription } from '@/lib/useTranscription';
import { CommandActionPreview } from './CommandActionPreview';
import { CommandIdleInput } from './CommandIdleInput';
import { CommandSuccess } from './CommandSuccess';
import { getCommandSelectedBinIds } from './commandSelectedBins';
import { AiSetupView } from './InlineAiSetup';
import { InventoryQueryResult } from './InventoryQueryResult';
import { PhotoBulkAdd } from './PhotoBulkAdd';
import { useActionExecutor } from './useActionExecutor';
import { useAiSettings } from './useAiSettings';
import { useCommandInputState } from './useCommandInputState';

interface CommandInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoTriggerPhoto?: boolean;
}

export function CommandInput({ open, onOpenChange, autoTriggerPhoto }: CommandInputProps) {
  const selectedBinIds = getCommandSelectedBinIds();
  const navigate = useNavigate();
  const t = useTerminology();

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
    state, isAiReady, aiSettings, aiSettingsLoading, selectedCount,
    actions, interpretation, error,
    handleParse, handleBack, toggleAction,
    handleClose, handlePhotoSelect, handleBinClick,
    handleExecuteComplete, handleAskAnother, handleFollowUp,
    scopeInfo,
  } = useCommandInputState(onOpenChange, selectedBinIds);

  const { settings: aiSettingsForMic } = useAiSettings();
  const canTranscribe = isAiReady && !!aiSettingsForMic && aiSettingsForMic.provider !== 'anthropic' && isRecordingSupported();

  const stateRef = useRef(state);
  stateRef.current = state;
  const handleFollowUpRef = useRef(handleFollowUp);
  handleFollowUpRef.current = handleFollowUp;
  const handleParseRef = useRef(handleParse);
  handleParseRef.current = handleParse;
  const setTextRef = useRef(setText);
  setTextRef.current = setText;

  const transcription = useTranscription({
    onTranscribed: (text) => {
      if (stateRef.current === 'query-result') {
        handleFollowUpRef.current(text);
      } else {
        setTextRef.current(text);
        // Defer parse to next tick so setText has flushed
        setTimeout(() => handleParseRef.current(), 0);
      }
    },
  });

  const { isExecuting, executingProgress, executeActions } = useActionExecutor({
    actions,
    checkedActions,
    onComplete: handleExecuteComplete,
  });

  // Auto-trigger photo picker when opened via "Scan more"
  const autoTriggeredRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: fileInputRef is a stable ref — .current must not be a dep
  useEffect(() => {
    if (open && autoTriggerPhoto && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      setTimeout(() => fileInputRef.current?.click(), 100);
    }
    if (!open) autoTriggeredRef.current = false;
  }, [open, autoTriggerPhoto]);

  // Pick up photos captured via the camera capture page
  const capturePickedUp = useRef(false);
  useEffect(() => {
    if (!open) {
      capturePickedUp.current = false;
      return;
    }
    if (capturePickedUp.current) return;
    capturePickedUp.current = true;
    const captured = takeCapturedPhotos();
    if (captured.length > 0) {
      setInitialFiles(captured);
      setPhotoMode(true);
    }
  }, [open, setInitialFiles, setPhotoMode]);

  function handleCameraClick() {
    handleClose(false);
    navigate('/capture');
  }

  // Augment state with executor state
  const effectiveState = isExecuting ? 'executing' : state;

  // Progress bar: show during parsing, hold at 100% briefly after completion
  const isParsing = effectiveState === 'parsing' || effectiveState === 'querying';
  const parseDone = !isParsing && (effectiveState === 'preview' || effectiveState === 'query-result');
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    if (isParsing) {
      setShowProgress(true);
      return;
    }
    if (parseDone) {
      const id = setTimeout(() => setShowProgress(false), 800);
      return () => clearTimeout(id);
    }
    // Error or back to idle — hide immediately
    setShowProgress(false);
  }, [isParsing, parseDone]);

  // Reset progress when dialog closes
  useEffect(() => {
    if (!open) setShowProgress(false);
  }, [open]);

  useEffect(() => {
    if (!open) transcription.cancel();
  }, [open, transcription]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{photoMode ? 'Create from Photos' : 'Ask AI'}</DialogTitle>
        </DialogHeader>

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />

        {scopeInfo.isScoped && !photoMode && (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-[var(--ai-accent)]/10 border border-[var(--ai-accent)]/20 px-3 py-2 mb-1 text-[13px]">
            <span className="text-[var(--text-secondary)]">
              Focused on {scopeInfo.binCount} selected {scopeInfo.binCount === 1 ? t.bin : t.bins}
            </span>
            <button
              type="button"
              className="text-[var(--ai-accent)] hover:underline whitespace-nowrap transition-colors"
              onClick={scopeInfo.clearScope}
            >
              Use all {t.bins} instead
            </button>
          </div>
        )}

        {photoMode ? (
          <div key="photo">
            <PhotoBulkAdd
              initialFiles={initialFiles}
              aiSettings={aiSettings}
              onClose={() => handleClose(false)}
              onBack={() => { setPhotoMode(false); setInitialFiles([]); }}
            />
          </div>
        ) : showProgress ? (
          <div key="progress" className="py-4 space-y-3">
            <AiProgressBar
              active={isParsing}
              complete={parseDone}
              label={isParsing ? 'Processing' : 'Complete'}
            />
            {isParsing && (
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ) : effectiveState === 'success' && executionResult ? (
          <div key="success">
            <CommandSuccess
              result={executionResult}
              onAskAnother={handleAskAnother}
              onClose={() => handleClose(false)}
              onBinClick={handleBinClick}
            />
          </div>
        ) : effectiveState === 'query-result' ? (
          <div key="query-result">
            <InventoryQueryResult
              queryResult={queryResult}
              streamingText={queryPartialText}
              isStreaming={isQueryStreaming}
              onBinClick={handleBinClick}
              onBack={handleBack}
              onFollowUp={handleFollowUp}
              transcription={canTranscribe ? transcription : undefined}
            />
          </div>
        ) : effectiveState === 'preview' && actions ? (
          <div key="preview">
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
          <div key="setup">
            <AiSetupView
              onNavigate={() => { handleClose(false); navigate('/settings/ai'); }}
              onDismiss={() => handleClose(false)}
            />
          </div>
        ) : (
          <div key="idle">
            <CommandIdleInput
              text={text}
              setText={setText}
              isLoading={isParsing}
              examplesOpen={examplesOpen}
              setExamplesOpen={setExamplesOpen}
              error={error}
              onParse={handleParse}
              onPhotoClick={() => fileInputRef.current?.click()}
              onCameraClick={handleCameraClick}
              isScoped={scopeInfo.isScoped}
              transcription={canTranscribe ? transcription : undefined}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { takeCapturedPhotos } from '@/features/capture/capturedPhotos';
import { isRecordingSupported } from '@/lib/audioRecorder';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { useTranscription } from '@/lib/useTranscription';
import { ConversationComposer } from './ConversationComposer';
import { ConversationThread } from './ConversationThread';
import { getCommandSelectedBinIds } from './commandSelectedBins';
import { EmptyConversationState } from './EmptyConversationState';
import { AiSetupView } from './InlineAiSetup';
import { PhotoBulkAdd } from './PhotoBulkAdd';
import { useAiSettings } from './useAiSettings';
import { useConversation } from './useConversation';

interface CommandInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoTriggerPhoto?: boolean;
}

export function CommandInput({ open, onOpenChange, autoTriggerPhoto }: CommandInputProps) {
  const selectedBinIds = getCommandSelectedBinIds();
  const navigate = useNavigate();
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const { settings, isLoading: aiSettingsLoading } = useAiSettings();

  const conversation = useConversation({
    locationId: activeLocationId,
    initialSelectedBinIds: selectedBinIds,
  });

  const [photoMode, setPhotoMode] = useState(false);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canTranscribe = !!settings && settings.provider !== 'anthropic' && isRecordingSupported();
  const isAiReady = settings !== null;

  const transcription = useTranscription({
    onTranscribed: (text) => {
      conversation.ask(text);
    },
  });

  // Clear conversation when dialog closes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — fire only on `open` transitions
  useEffect(() => {
    if (!open) {
      conversation.clearConversation();
      setPhotoMode(false);
      setInitialFiles([]);
      transcription.cancel();
    }
  }, [open]);

  // Auto-trigger photo picker when opened via "Scan more"
  const autoTriggeredRef = useRef(false);
  useEffect(() => {
    if (open && autoTriggerPhoto && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      setTimeout(() => fileInputRef.current?.click(), 100);
    }
    if (!open) autoTriggeredRef.current = false;
  }, [open, autoTriggerPhoto]);

  // Pick up photos captured via the /capture page
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
  }, [open]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setInitialFiles(Array.from(files));
    setPhotoMode(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleBinClick(binId: string, isTrashed?: boolean) {
    onOpenChange(false);
    if (isTrashed) {
      navigate('/trash');
    } else {
      navigate(`/bin/${binId}`, { state: { backLabel: t.Bins, backPath: '/bins' } });
    }
  }

  const executingProgressProp = conversation.executingTurnId
    ? {
        turnId: conversation.executingTurnId,
        current: conversation.executingProgress.current,
        total: conversation.executingProgress.total,
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[min(720px,85vh)] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-[var(--border-subtle)]">
          <DialogTitle>{photoMode ? 'Create from Photos' : 'Ask AI'}</DialogTitle>
          {conversation.scopeInfo.isScoped && !photoMode && (
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 bg-[var(--tab-pill-bg)] text-[var(--ai-accent)] px-2.5 py-0.5 rounded-full text-[12px]">
                Focused on {conversation.scopeInfo.binCount}{' '}
                {conversation.scopeInfo.binCount === 1 ? t.bin : t.bins}
                <button
                  type="button"
                  onClick={conversation.scopeInfo.clearScope}
                  className="ml-0.5 text-[var(--ai-accent)] hover:underline"
                  aria-label="Clear scope"
                >
                  ×
                </button>
              </span>
            </div>
          )}
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handlePhotoSelect}
        />

        {photoMode ? (
          <PhotoBulkAdd
            initialFiles={initialFiles}
            aiSettings={settings}
            onClose={() => onOpenChange(false)}
            onBack={() => {
              setPhotoMode(false);
              setInitialFiles([]);
            }}
          />
        ) : !aiSettingsLoading && !isAiReady ? (
          <div className="p-4">
            <AiSetupView
              onNavigate={() => {
                onOpenChange(false);
                navigate('/settings/ai');
              }}
              onDismiss={() => onOpenChange(false)}
            />
          </div>
        ) : (
          <>
            {conversation.turns.length === 0 ? (
              <div className="flex-1 overflow-y-auto px-4">
                <EmptyConversationState
                  isScoped={conversation.scopeInfo.isScoped}
                  onPickExample={conversation.ask}
                />
              </div>
            ) : (
              <ConversationThread
                turns={conversation.turns}
                onToggleAction={conversation.toggleAction}
                onExecute={conversation.executeActions}
                onBinClick={handleBinClick}
                onRetry={conversation.retry}
                executingProgress={executingProgressProp}
              />
            )}
            <ConversationComposer
              onSend={conversation.ask}
              onCancel={conversation.cancelStreaming}
              onPhotoClick={() => fileInputRef.current?.click()}
              onCameraClick={() => {
                onOpenChange(false);
                navigate('/capture');
              }}
              isStreaming={conversation.isStreaming}
              transcription={canTranscribe ? transcription : undefined}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

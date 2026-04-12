import { SquarePen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { takeCapturedPhotos } from '@/features/capture/capturedPhotos';
import { isRecordingSupported } from '@/lib/audioRecorder';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { useTranscription } from '@/lib/useTranscription';
import { ConversationComposer } from './ConversationComposer';
import { ConversationScopePill } from './ConversationScopePill';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent flush className="sm:max-w-lg h-[min(720px,85vh)]">
        <DialogHeader className="shrink-0 px-5 pt-4 pb-3 mb-0 text-left border-b border-[var(--border-subtle)]">
          <DialogTitle>{photoMode ? 'Create from Photos' : 'Ask AI'}</DialogTitle>
          {conversation.scopeInfo.isScoped && !photoMode && (
            <div className="flex items-center gap-2 mt-1">
              <ConversationScopePill
                binCount={conversation.scopeInfo.binCount}
                onClear={conversation.scopeInfo.clearScope}
              />
            </div>
          )}
        </DialogHeader>

        {!photoMode && conversation.turns.length > 0 && (
          <button
            type="button"
            aria-label="New chat"
            title="New chat"
            className="ai-newchat-enter absolute right-14 top-2.5 z-10 rounded-[var(--radius-sm)] h-11 w-11 bg-[var(--bg-input)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center"
            onClick={conversation.clearConversation}
          >
            <SquarePen className="h-4 w-4" />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handlePhotoSelect}
        />

        {photoMode ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-[calc(24px+var(--safe-bottom))]">
            <PhotoBulkAdd
              initialFiles={initialFiles}
              aiSettings={settings}
              onClose={() => onOpenChange(false)}
              onBack={() => {
                setPhotoMode(false);
                setInitialFiles([]);
              }}
            />
          </div>
        ) : !aiSettingsLoading && !isAiReady ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
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
              <div className="flex-1 min-h-0 overflow-y-auto px-5">
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
                executingProgress={conversation.executing}
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

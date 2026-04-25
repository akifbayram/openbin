import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { takeCapturedPhotos } from '@/features/capture/capturedPhotos';
import { isRecordingSupported } from '@/lib/audioRecorder';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { useTranscription } from '@/lib/useTranscription';
import { ConversationComposer } from './ConversationComposer';
import { ConversationThread } from './ConversationThread';
import { EmptyConversationState } from './EmptyConversationState';
import { AiSetupView } from './InlineAiSetup';
import { PhotoBulkAdd } from './PhotoBulkAdd';
import { useAiSettings } from './useAiSettings';
import { type UseConversationReturn, useConversation } from './useConversation';

/**
 * Shared shell powering both the desktop `CommandInput` dialog and the mobile
 * `AskPage` route. Owns conversation state, photo-mode state, and the capture
 * pickup effect. Callers render their own chrome (dialog frame vs full-page
 * frame) via `renderChrome` and read state from the `shell` arg passed to it.
 */

export interface ConversationShellState {
  conversation: UseConversationReturn;
  photoMode: boolean;
  /** Whether AI provider settings are configured and ready to use. */
  isAiReady: boolean;
  /** True while the AI settings request is still in flight. */
  aiSettingsLoading: boolean;
  /** Opens the system file picker for images. */
  openPhotoPicker: () => void;
}

interface ConversationUIProps {
  /** Scope the conversation to a specific set of bins (desktop "ask about these"). */
  initialSelectedBinIds?: string[];
  /** When true, auto-clicks the hidden photo input once on mount (used for "Scan more"). */
  autoTriggerPhoto?: boolean;
  /**
   * When transitioning from true → false, resets conversation, photo mode, and
   * transcription. Defaults to true. CommandInput drives this from its `open` prop;
   * AskPage leaves it at the default (route unmounts instead).
   */
  active?: boolean;
  /** Called when user taps a bin in a query match; parent decides whether to close/navigate. */
  onBinNavigate: (binId: string, isTrashed: boolean) => void;
  /** Called when user taps the camera button in the composer. */
  onCameraRequest: () => void;
  /** Called when the photo-bulk-add flow wants to close the whole shell. */
  onPhotoClose: () => void;
  /** Called when the AI setup view wants to route to settings. */
  onOpenAiSettings: () => void;
  /** Called when the AI setup view is dismissed without configuring. */
  onDismissAiSetup: () => void;
  /** Wrapper class for the photo-bulk-add container (dialog vs full-page differ in padding). */
  photoFrameClassName?: string;
  /** Render the chrome (header, new-chat button, etc.) around the shared body. */
  renderChrome: (shell: ConversationShellState) => React.ReactNode;
  /** Portal target for the photo bulk-add flow progress indicator (rendered in the chrome between title and close). */
  headerToolbarTarget?: HTMLElement | null;
}

export function ConversationUI({
  initialSelectedBinIds,
  autoTriggerPhoto,
  active = true,
  onBinNavigate,
  onCameraRequest,
  onPhotoClose,
  onOpenAiSettings,
  onDismissAiSetup,
  photoFrameClassName,
  renderChrome,
  headerToolbarTarget,
}: ConversationUIProps): React.ReactElement {
  const { activeLocationId } = useAuth();
  const { settings, isLoading: aiSettingsLoading } = useAiSettings();

  const conversation = useConversation({
    locationId: activeLocationId,
    initialSelectedBinIds,
  });

  const [photoMode, setPhotoMode] = useState(false);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);
  const [initialGroups, setInitialGroups] = useState<number[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canTranscribe = !!settings && settings.provider !== 'anthropic' && isRecordingSupported();
  const isAiReady = settings !== null;

  const transcription = useTranscription({
    onTranscribed: (text) => {
      conversation.ask(text);
    },
  });

  // Reset state when `active` transitions to false (dialog close).
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — fire only on `active` transitions
  useEffect(() => {
    if (!active) {
      conversation.clearConversation();
      setPhotoMode(false);
      setInitialFiles([]);
      setInitialGroups(null);
      transcription.cancel();
    }
  }, [active]);

  // Auto-trigger photo picker (e.g. "Scan more" quick action). Fires once per active cycle.
  const autoTriggeredRef = useRef(false);
  useEffect(() => {
    if (active && autoTriggerPhoto && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      setTimeout(() => fileInputRef.current?.click(), 100);
    }
    if (!active) autoTriggeredRef.current = false;
  }, [active, autoTriggerPhoto]);

  // Pick up photos captured via the /capture page. Fires once per active cycle.
  const capturePickedUpRef = useRef(false);
  useEffect(() => {
    if (!active) {
      capturePickedUpRef.current = false;
      return;
    }
    if (capturePickedUpRef.current) return;
    capturePickedUpRef.current = true;
    const captured = takeCapturedPhotos();
    if (captured.files.length > 0) {
      setInitialFiles(captured.files);
      setInitialGroups(captured.groups);
      setPhotoMode(true);
    }
  }, [active]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setInitialFiles(Array.from(files));
    setInitialGroups(null);
    setPhotoMode(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openPhotoPicker() {
    fileInputRef.current?.click();
  }

  const shell: ConversationShellState = {
    conversation,
    photoMode,
    isAiReady,
    aiSettingsLoading,
    openPhotoPicker,
  };

  const photoBulkAdd = (
    <PhotoBulkAdd
      initialFiles={initialFiles}
      initialGroups={initialGroups}
      aiSettings={settings}
      onClose={onPhotoClose}
      onBack={() => {
        setPhotoMode(false);
        setInitialFiles([]);
        setInitialGroups(null);
      }}
      headerToolbarTarget={headerToolbarTarget}
    />
  );

  return (
    <>
      {renderChrome(shell)}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handlePhotoSelect}
      />

      {photoMode ? (
        photoFrameClassName ? <div className={photoFrameClassName}>{photoBulkAdd}</div> : photoBulkAdd
      ) : !aiSettingsLoading && !isAiReady ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <AiSetupView onNavigate={onOpenAiSettings} onDismiss={onDismissAiSetup} />
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
              onBinClick={(binId, isTrashed) => onBinNavigate(binId, !!isTrashed)}
              onRetry={conversation.retry}
              executingProgress={conversation.executing}
            />
          )}
          <ConversationComposer
            onSend={conversation.ask}
            onCancel={conversation.cancelStreaming}
            onPhotoClick={openPhotoPicker}
            onCameraClick={onCameraRequest}
            isStreaming={conversation.isStreaming}
            transcription={canTranscribe ? transcription : undefined}
          />
        </>
      )}
    </>
  );
}

/**
 * Shared bin-click navigator used by both entry points. The optional
 * `afterNavigate` callback runs before navigation — CommandInput uses it to
 * close the dialog, AskPage skips it entirely.
 */
export function useBinNavigate(afterNavigate?: () => void) {
  const navigate = useNavigate();
  const t = useTerminology();
  return function handleBinClick(binId: string, isTrashed: boolean) {
    afterNavigate?.();
    if (isTrashed) {
      navigate('/trash');
    } else {
      navigate(`/bin/${binId}`, { state: { backLabel: t.Bins, backPath: '/bins' } });
    }
  };
}

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isRecordingSupported } from '@/lib/audioRecorder';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { useTranscription } from '@/lib/useTranscription';
import { ConversationComposer } from './ConversationComposer';
import { ConversationThread } from './ConversationThread';
import { EmptyConversationState } from './EmptyConversationState';
import { AiSetupView } from './InlineAiSetup';
import { useAiSettings } from './useAiSettings';
import { type UseConversationReturn, useConversation } from './useConversation';

/**
 * Shared shell powering the `CommandInput` dialog. Owns conversation state.
 * Callers render their own chrome (dialog frame, header) via `renderChrome`
 * and read state from the `shell` arg passed to it.
 */

export interface ConversationShellState {
  conversation: UseConversationReturn;
  /** Whether AI provider settings are configured and ready to use. */
  isAiReady: boolean;
  /** True while the AI settings request is still in flight. */
  aiSettingsLoading: boolean;
}

interface ConversationUIProps {
  /** Scope the conversation to a specific set of bins (desktop "ask about these"). */
  initialSelectedBinIds?: string[];
  /**
   * When transitioning from true → false, resets conversation and transcription.
   * Defaults to true. CommandInput drives this from its `open` prop.
   */
  active?: boolean;
  /** Called when user taps a bin in a query match; parent decides whether to close/navigate. */
  onBinNavigate: (binId: string, isTrashed: boolean) => void;
  /** Called when user taps the camera button in the composer. */
  onCameraRequest: () => void;
  /** Called when user taps the gallery (upload) button in the composer. Falls back to onCameraRequest if omitted. */
  onGalleryRequest?: () => void;
  /** Called when the AI setup view wants to route to settings. */
  onOpenAiSettings: () => void;
  /** Called when the AI setup view is dismissed without configuring. */
  onDismissAiSetup: () => void;
  /** Render the chrome (header, new-chat button, etc.) around the shared body. */
  renderChrome: (shell: ConversationShellState) => React.ReactNode;
}

export function ConversationUI({
  initialSelectedBinIds,
  active = true,
  onBinNavigate,
  onCameraRequest,
  onGalleryRequest,
  onOpenAiSettings,
  onDismissAiSetup,
  renderChrome,
}: ConversationUIProps): React.ReactElement {
  const { activeLocationId } = useAuth();
  const { settings, isLoading: aiSettingsLoading } = useAiSettings();

  const conversation = useConversation({
    locationId: activeLocationId,
    initialSelectedBinIds,
  });

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
      transcription.cancel();
    }
  }, [active]);

  const shell: ConversationShellState = {
    conversation,
    isAiReady,
    aiSettingsLoading,
  };

  return (
    <>
      {renderChrome(shell)}

      {!aiSettingsLoading && !isAiReady ? (
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
            onPhotoClick={onGalleryRequest ?? onCameraRequest}
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
 * Bin-click navigator. The optional `afterNavigate` callback runs before
 * navigation — CommandInput uses it to close the dialog.
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

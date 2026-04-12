import { ChevronLeft, SquarePen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { takeCapturedPhotos } from '@/features/capture/capturedPhotos';
import { isRecordingSupported } from '@/lib/audioRecorder';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { useTranscription } from '@/lib/useTranscription';
import { ConversationComposer } from './ConversationComposer';
import { ConversationScopePill } from './ConversationScopePill';
import { ConversationThread } from './ConversationThread';
import { EmptyConversationState } from './EmptyConversationState';
import { AiSetupView } from './InlineAiSetup';
import { PhotoBulkAdd } from './PhotoBulkAdd';
import { useAiSettings } from './useAiSettings';
import { useConversation } from './useConversation';

export function AskPage() {
  const navigate = useNavigate();
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const { settings, isLoading: aiSettingsLoading } = useAiSettings();

  const conversation = useConversation({ locationId: activeLocationId });

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

  // Pick up photos captured via the /capture page (fire once on mount)
  const capturePickedUp = useRef(false);
  useEffect(() => {
    if (capturePickedUp.current) return;
    capturePickedUp.current = true;
    const captured = takeCapturedPhotos();
    if (captured.length > 0) {
      setInitialFiles(captured);
      setPhotoMode(true);
    }
  }, []);

  function handleBack() {
    // Fall back to home if we'd otherwise land outside the SPA
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setInitialFiles(Array.from(files));
    setPhotoMode(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleBinClick(binId: string, isTrashed?: boolean) {
    if (isTrashed) {
      navigate('/trash');
    } else {
      navigate(`/bin/${binId}`, { state: { backLabel: t.Bins, backPath: '/bins' } });
    }
  }

  const title = photoMode ? 'Create from Photos' : 'Ask AI';

  return (
    <div className="fixed inset-0 z-50 flex flex-col min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Top bar — safe-area aware with back button + title */}
      <div
        className="flex items-center gap-2 px-3 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))', paddingBottom: '0.5rem' }}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleBack}
          aria-label="Go back"
          className="shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-[17px] font-semibold text-[var(--text-primary)] leading-none">
          {title}
        </h1>
        {conversation.scopeInfo.isScoped && !photoMode && (
          <div className="ml-2">
            <ConversationScopePill
              binCount={conversation.scopeInfo.binCount}
              onClear={conversation.scopeInfo.clearScope}
            />
          </div>
        )}
        {!photoMode && conversation.turns.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={conversation.clearConversation}
            aria-label="New chat"
            title="New chat"
            className="ai-newchat-enter ml-auto shrink-0"
          >
            <SquarePen className="h-5 w-5" />
          </Button>
        )}
      </div>

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
          onClose={handleBack}
          onBack={() => {
            setPhotoMode(false);
            setInitialFiles([]);
          }}
        />
      ) : !aiSettingsLoading && !isAiReady ? (
        <div className="p-4">
          <AiSetupView
            onNavigate={() => navigate('/settings/ai')}
            onDismiss={handleBack}
          />
        </div>
      ) : (
        <>
          {conversation.turns.length === 0 ? (
            <div className="flex-1 overflow-y-auto px-5">
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
            onCameraClick={() => navigate('/capture')}
            isStreaming={conversation.isStreaming}
            transcription={canTranscribe ? transcription : undefined}
          />
        </>
      )}
    </div>
  );
}

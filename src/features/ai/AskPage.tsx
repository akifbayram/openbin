import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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

  const executingProgressProp = conversation.executingTurnId
    ? {
        turnId: conversation.executingTurnId,
        current: conversation.executingProgress.current,
        total: conversation.executingProgress.total,
      }
    : null;

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
          <span className="ml-2 inline-flex items-center gap-1 bg-[var(--tab-pill-bg)] text-[var(--ai-accent)] px-2.5 py-0.5 rounded-full text-[12px]">
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
            onCameraClick={() => navigate('/capture')}
            isStreaming={conversation.isStreaming}
            transcription={canTranscribe ? transcription : undefined}
          />
        </>
      )}
    </div>
  );
}

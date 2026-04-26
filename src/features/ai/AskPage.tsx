import { ChevronLeft, SquarePen } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TourLauncher } from '@/features/tour/TourLauncher';
import { ConversationScopePill } from './ConversationScopePill';
import { ConversationUI, useBinNavigate } from './ConversationUI';

export function AskPage() {
  const navigate = useNavigate();
  const handleBinNavigate = useBinNavigate();
  const [photoToolbarEl, setPhotoToolbarEl] = useState<HTMLDivElement | null>(null);

  function handleBack() {
    // Fall back to home if we'd otherwise land outside the SPA
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <ConversationUI
        onBinNavigate={handleBinNavigate}
        onCameraRequest={() => navigate('/new-bin?camera=open&from=ask')}
        onPhotoClose={handleBack}
        onOpenAiSettings={() => navigate('/settings/ai')}
        onDismissAiSetup={handleBack}
        photoFrameClassName="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] px-4 pt-4 pb-[calc(24px+var(--safe-bottom))]"
        headerToolbarTarget={photoToolbarEl}
        renderChrome={({ conversation, photoMode }) => (
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
              {photoMode ? 'New Bin' : 'Ask AI'}
            </h1>
            {conversation.scopeInfo.isScoped && !photoMode && (
              <div className="ml-2">
                <ConversationScopePill
                  binCount={conversation.scopeInfo.binCount}
                  onClear={conversation.scopeInfo.clearScope}
                />
              </div>
            )}
            <div className="ml-auto flex items-center gap-1 shrink-0">
              {!photoMode && <TourLauncher tourId="ask-ai" />}
              {!photoMode && conversation.turns.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={conversation.clearConversation}
                  aria-label="New chat"
                  title="New chat"
                  className="ai-newchat-enter"
                >
                  <SquarePen className="h-5 w-5" />
                </Button>
              )}
              {photoMode && <div ref={setPhotoToolbarEl} className="flex items-center gap-1" />}
            </div>
          </div>
        )}
      />
    </div>
  );
}

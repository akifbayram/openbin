import { ChevronLeft, SquarePen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ConversationScopePill } from './ConversationScopePill';
import { ConversationUI, useBinNavigate } from './ConversationUI';

export function AskPage() {
  const navigate = useNavigate();
  const handleBinNavigate = useBinNavigate();

  function handleBack() {
    // Fall back to home if we'd otherwise land outside the SPA
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <ConversationUI
        onBinNavigate={handleBinNavigate}
        onCameraRequest={() => navigate('/capture')}
        onPhotoClose={handleBack}
        onOpenAiSettings={() => navigate('/settings/ai')}
        onDismissAiSetup={handleBack}
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
              {photoMode ? 'Create from Photos' : 'Ask AI'}
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
        )}
      />
    </div>
  );
}

import { SquarePen } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TourLauncher } from '@/features/tour/TourLauncher';
import { ConversationScopePill } from './ConversationScopePill';
import { ConversationUI, useBinNavigate } from './ConversationUI';
import { getCommandSelectedBinIds } from './commandSelectedBins';

interface CommandInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoTriggerPhoto?: boolean;
}

export function CommandInput({ open, onOpenChange, autoTriggerPhoto }: CommandInputProps) {
  const selectedBinIds = getCommandSelectedBinIds();
  const navigate = useNavigate();
  const handleBinNavigate = useBinNavigate(() => onOpenChange(false));
  const [photoToolbarEl, setPhotoToolbarEl] = useState<HTMLDivElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent flush className="sm:max-w-lg h-[min(720px,85vh)]">
        <ConversationUI
          active={open}
          autoTriggerPhoto={autoTriggerPhoto}
          initialSelectedBinIds={selectedBinIds}
          photoFrameClassName="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] px-5 pt-5 pb-[calc(24px+var(--safe-bottom))]"
          onBinNavigate={handleBinNavigate}
          onCameraRequest={() => {
            onOpenChange(false);
            navigate('/capture');
          }}
          onPhotoClose={() => onOpenChange(false)}
          onOpenAiSettings={() => {
            onOpenChange(false);
            navigate('/settings/ai');
          }}
          onDismissAiSetup={() => onOpenChange(false)}
          headerToolbarTarget={photoToolbarEl}
          renderChrome={({ conversation, photoMode }) => (
            <>
              <DialogHeader className="shrink-0 px-5 pt-4 pb-3 mb-0 text-left border-b border-[var(--border-subtle)]">
                <DialogTitle>{photoMode ? 'New Bin' : 'Ask AI'}</DialogTitle>
                {conversation.scopeInfo.isScoped && !photoMode && (
                  <div className="flex items-center gap-2 mt-1">
                    <ConversationScopePill
                      binCount={conversation.scopeInfo.binCount}
                      onClear={conversation.scopeInfo.clearScope}
                    />
                  </div>
                )}
              </DialogHeader>

              {!photoMode && (
                <div className="absolute right-14 top-2.5 z-10 flex items-center gap-1">
                  <TourLauncher tourId="ask-ai" />
                  {conversation.turns.length > 0 && (
                    <button
                      type="button"
                      aria-label="New chat"
                      title="New chat"
                      className="ai-newchat-enter rounded-[var(--radius-sm)] h-9 w-9 bg-[var(--bg-input)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center"
                      onClick={conversation.clearConversation}
                    >
                      <SquarePen className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {photoMode && (
                <div
                  ref={setPhotoToolbarEl}
                  className="absolute right-20 top-2.5 z-10 h-11 flex items-center gap-1"
                />
              )}
            </>
          )}
        />
      </DialogContent>
    </Dialog>
  );
}

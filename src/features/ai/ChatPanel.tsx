import { Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';
import { useAiSettings } from './useAiSettings';
import { useChat } from './useChat';

interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXAMPLE_PROMPTS = [
  'What bins have holiday decorations?',
  'Find all items tagged "fragile"',
  'Create a bin for kitchen utensils',
  'Where did I put my winter jacket?',
];

export function ChatPanel({ open, onOpenChange }: ChatPanelProps) {
  const { settings, isLoading: aiLoading } = useAiSettings();
  const { messages, isStreaming, sendMessage, confirmActions, abort, clearChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Abort streaming when dialog closes
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && isStreaming) {
        abort();
      }
      onOpenChange(next);
    },
    [isStreaming, abort, onOpenChange],
  );

  const handleClose = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const aiConfigured = !aiLoading && settings !== null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg !p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-primary)] px-5 pt-5 pb-3">
          <DialogHeader className="!mb-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[var(--accent)]" />
              Assistant
            </DialogTitle>
          </DialogHeader>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body */}
        {!aiConfigured ? (
          /* Setup prompt */
          <div className="flex flex-col items-center justify-center gap-3 px-8 py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-tertiary)]">
              <Sparkles className="h-6 w-6 text-[var(--text-tertiary)]" />
            </div>
            <p className="text-center text-[14px] text-[var(--text-secondary)]">
              Set up AI to get started
            </p>
            <p className="text-center text-[13px] text-[var(--text-tertiary)]">
              Configure an AI provider in Settings to use the assistant.
            </p>
          </div>
        ) : (
          <>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4" style={{ minHeight: 200, maxHeight: 'calc(70vh - 140px)' }}>
              {messages.length === 0 ? (
                /* Empty state with example prompts */
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-tertiary)]">
                    <Sparkles className="h-5 w-5 text-[var(--text-tertiary)]" />
                  </div>
                  <p className="text-[13px] text-[var(--text-tertiary)]">Try asking something like:</p>
                  <div className="flex w-full flex-col gap-2">
                    {EXAMPLE_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => sendMessage(prompt)}
                        className="w-full rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)]"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, i) => (
                    <ChatMessage
                      key={`${msg.role}-${i}`}
                      message={msg}
                      onConfirmActions={confirmActions}
                      onClose={handleClose}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <ChatInput
              onSend={sendMessage}
              onAbort={abort}
              isStreaming={isStreaming}
              disabled={!aiConfigured}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

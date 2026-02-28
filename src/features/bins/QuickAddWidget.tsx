import { ChevronLeft, Check, Plus, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import type { useQuickAdd } from './useQuickAdd';

interface QuickAddWidgetProps {
  quickAdd: ReturnType<typeof useQuickAdd>;
  aiEnabled: boolean;
}

export function QuickAddWidget({ quickAdd, aiEnabled }: QuickAddWidgetProps) {
  return (
    <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2.5 transition-all duration-200">
      {quickAdd.state === 'input' && (
        <div className="flex items-center gap-1.5">
          <Input
            value={quickAdd.value}
            onChange={(e) => quickAdd.setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                quickAdd.handleAdd();
              }
            }}
            onPaste={quickAdd.handlePaste}
            placeholder="Add item..."
            disabled={quickAdd.saving}
            className="h-7 bg-transparent px-0.5 py-0 text-base focus-visible:ring-0"
          />
          {quickAdd.value.trim() && (
            <Tooltip content="Add item">
              <button
                type="button"
                onClick={quickAdd.handleAdd}
                disabled={quickAdd.saving}
                className="shrink-0 rounded-full p-1 text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors disabled:opacity-50"
                aria-label="Add item"
              >
                <Plus className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
          {aiEnabled && (
            <Tooltip content="Add with AI">
              <button
                type="button"
                onClick={quickAdd.handleAiClick}
                className="shrink-0 rounded-full p-1 text-[var(--ai-accent)] hover:bg-[var(--bg-active)] transition-colors"
                aria-label="Add with AI"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
        </div>
      )}

      {(quickAdd.state === 'expanded' || quickAdd.state === 'processing') && (
        <div className="space-y-2">
          <textarea
            autoComplete="off"
            value={quickAdd.expandedText}
            onChange={(e) => quickAdd.setExpandedText(e.target.value)}
            onKeyDown={quickAdd.handleExpandedKeyDown}
            placeholder="List or describe items, e.g. 'three socks, AA batteries, winter jacket'"
            rows={3}
            disabled={quickAdd.isStructuring}
            autoFocus
            className="w-full min-h-[80px] bg-[var(--bg-elevated)] rounded-[var(--radius-sm)] px-3 py-2 text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none disabled:opacity-50"
          />
          {quickAdd.structureError && (
            <p className="text-[13px] text-[var(--destructive)]">{quickAdd.structureError}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={quickAdd.cancelExpanded}
              className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <div className="flex-1" />
            <Button
              type="button"
              size="sm"
              onClick={quickAdd.handleExtractClick}
              disabled={!quickAdd.expandedText.trim() || quickAdd.isStructuring}
              className="rounded-[var(--radius-full)] gap-1.5 bg-[var(--ai-accent)] hover:bg-[var(--ai-accent-hover)]"
            >
              {quickAdd.isStructuring ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {quickAdd.isStructuring ? 'Thinking...' : 'Go'}
            </Button>
          </div>
        </div>
      )}

      {quickAdd.state === 'preview' && quickAdd.structuredItems && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {quickAdd.structuredItems.map((item, i) => {
              const checked = quickAdd.checked.get(i) !== false;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => quickAdd.toggleChecked(i)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] transition-all ${
                    checked
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] line-through'
                  }`}
                >
                  {checked && <Check className="h-3 w-3" />}
                  {item}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={quickAdd.backToExpanded}
              className="rounded-[var(--radius-full)] gap-0.5"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              size="sm"
              onClick={quickAdd.handleConfirmAdd}
              disabled={quickAdd.selectedCount === 0}
              className="rounded-[var(--radius-full)]"
            >
              Add {quickAdd.selectedCount}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { Check, ChevronLeft, Loader2, Plus, Sparkles } from 'lucide-react';
import { Button, Input } from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import type { useQuickAdd } from './useQuickAdd';

interface QuickAddWidgetProps {
  quickAdd: ReturnType<typeof useQuickAdd>;
  aiEnabled: boolean;
}

export function QuickAddWidget({ quickAdd, aiEnabled }: QuickAddWidgetProps) {
  return (
    <div className="mt-3 rounded-[var(--radius-md)] bg-gray-500/12 dark:bg-gray-500/24 p-2.5 transition-all duration-200">
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
                className="shrink-0 rounded-full p-1 text-purple-600 dark:text-purple-400 hover:bg-gray-500/16 dark:hover:bg-gray-500/28 transition-colors disabled:opacity-50"
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
                className="shrink-0 rounded-full p-1 text-purple-600 dark:text-purple-400 hover:bg-gray-500/16 dark:hover:bg-gray-500/28 transition-colors"
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
            className="w-full min-h-[80px] bg-white/70 dark:bg-gray-800/70 rounded-[var(--radius-sm)] px-3 py-2 text-base  placeholder:text-gray-500 dark:placeholder:text-gray-400 outline-none resize-none disabled:opacity-50"
          />
          {quickAdd.structureError && (
            <p className="text-[13px] text-red-500 dark:text-red-400">{quickAdd.structureError}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={quickAdd.cancelExpanded}
              className="text-[13px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Cancel
            </button>
            <div className="flex-1" />
            <Button
              type="button"
              size="sm"
              onClick={quickAdd.handleExtractClick}
              disabled={!quickAdd.expandedText.trim() || quickAdd.isStructuring}
              className="rounded-[var(--radius-full)] gap-1.5 bg-purple-600 dark:bg-purple-500 hover:bg-purple-700 dark:hover:bg-purple-400"
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
                // biome-ignore lint/suspicious/noArrayIndexKey: items identified by index for toggle
                <button key={i}
                  type="button"
                  onClick={() => quickAdd.toggleChecked(i)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] transition-all ${
                    checked
                      ? 'bg-purple-600 dark:bg-purple-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-900 text-gray-500 dark:text-gray-400 line-through'
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

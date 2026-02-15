import { useState, useCallback } from 'react';
import {
  Sparkles, Loader2, ChevronLeft, Check, Plus, Minus, Package, Trash2,
  Tag, MapPin, FileText, Palette, Image as ImageIcon,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useAiSettings } from './useAiSettings';
import { useCommand, type CommandAction } from './useCommand';
import { useAiProviderSetup } from './useAiProviderSetup';
import { InlineAiSetup, AiConfiguredIndicator } from './InlineAiSetup';
import { addBin, updateBin, deleteBin, restoreBin, notifyBinsChanged } from '@/features/bins/useBins';
import { useAreaList, createArea } from '@/features/areas/useAreas';
import { apiFetch } from '@/lib/api';
import type { Bin } from '@/types';

interface CommandInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type State = 'idle' | 'parsing' | 'preview' | 'executing';

function isDestructiveAction(action: CommandAction): boolean {
  return action.type === 'delete_bin' || action.type === 'remove_items' || action.type === 'remove_tags';
}

function getActionIcon(action: CommandAction) {
  switch (action.type) {
    case 'add_items': return Plus;
    case 'remove_items': return Minus;
    case 'modify_item': return FileText;
    case 'create_bin': return Package;
    case 'delete_bin': return Trash2;
    case 'add_tags': return Tag;
    case 'remove_tags': return Tag;
    case 'modify_tag': return Tag;
    case 'set_area': return MapPin;
    case 'set_notes': return FileText;
    case 'set_icon': return ImageIcon;
    case 'set_color': return Palette;
  }
}

function describeAction(action: CommandAction): string {
  switch (action.type) {
    case 'add_items':
      return `Add ${action.items.join(', ')} to "${action.bin_name}"`;
    case 'remove_items':
      return `Remove ${action.items.join(', ')} from "${action.bin_name}"`;
    case 'modify_item':
      return `Rename "${action.old_item}" to "${action.new_item}" in "${action.bin_name}"`;
    case 'create_bin': {
      let desc = `Create bin "${action.name}"`;
      if (action.area_name) desc += ` in ${action.area_name}`;
      if (action.items?.length) desc += ` with ${action.items.length} item${action.items.length !== 1 ? 's' : ''}`;
      return desc;
    }
    case 'delete_bin':
      return `Delete "${action.bin_name}"`;
    case 'add_tags':
      return `Add tag${action.tags.length !== 1 ? 's' : ''} ${action.tags.join(', ')} to "${action.bin_name}"`;
    case 'remove_tags':
      return `Remove tag${action.tags.length !== 1 ? 's' : ''} ${action.tags.join(', ')} from "${action.bin_name}"`;
    case 'modify_tag':
      return `Rename tag "${action.old_tag}" to "${action.new_tag}" on "${action.bin_name}"`;
    case 'set_area':
      return `Move "${action.bin_name}" to area "${action.area_name}"`;
    case 'set_notes':
      if (action.mode === 'clear') return `Clear notes on "${action.bin_name}"`;
      if (action.mode === 'append') return `Append to notes on "${action.bin_name}"`;
      return `Set notes on "${action.bin_name}"`;
    case 'set_icon':
      return `Set icon on "${action.bin_name}" to ${action.icon}`;
    case 'set_color':
      return `Set color on "${action.bin_name}" to ${action.color}`;
  }
}

export function CommandInput({ open, onOpenChange }: CommandInputProps) {
  const { activeLocationId } = useAuth();
  const { settings, isLoading: aiSettingsLoading } = useAiSettings();
  const { showToast } = useToast();
  const { areas } = useAreaList(activeLocationId);
  const { actions, interpretation, isParsing, error, parse, clearCommand } = useCommand();
  const [text, setText] = useState('');
  const [checkedActions, setCheckedActions] = useState<Map<number, boolean>>(new Map());
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingProgress, setExecutingProgress] = useState({ current: 0, total: 0 });

  // Inline AI setup
  const [aiExpanded, setAiExpanded] = useState(false);
  const setup = useAiProviderSetup({ onSaveSuccess: () => setAiExpanded(false) });

  const state: State = isExecuting ? 'executing' : isParsing ? 'parsing' : actions ? 'preview' : 'idle';

  const isAiReady = settings !== null || setup.configured;

  async function handleParse() {
    if (!text.trim() || !activeLocationId) return;
    if (!isAiReady) {
      setAiExpanded(true);
      return;
    }
    const result = await parse({ text: text.trim(), locationId: activeLocationId });
    if (result?.actions) {
      const initial = new Map<number, boolean>();
      result.actions.forEach((_, i) => initial.set(i, true));
      setCheckedActions(initial);
    }
  }

  function handleBack() {
    clearCommand();
    setCheckedActions(new Map());
  }

  function toggleAction(index: number) {
    setCheckedActions((prev) => {
      const next = new Map(prev);
      next.set(index, !(prev.get(index) ?? true));
      return next;
    });
  }

  const selectedCount = actions
    ? actions.filter((_, i) => checkedActions.get(i) !== false).length
    : 0;

  const executeActions = useCallback(async () => {
    if (!actions || !activeLocationId) return;

    const selected = actions.filter((_, i) => checkedActions.get(i) !== false);
    if (selected.length === 0) return;

    setIsExecuting(true);
    setExecutingProgress({ current: 0, total: selected.length });
    let completed = 0;

    for (let idx = 0; idx < selected.length; idx++) {
      const action = selected[idx];
      setExecutingProgress({ current: idx + 1, total: selected.length });
      try {
        switch (action.type) {
          case 'add_items': {
            const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
            const newItems = [...(bin.items || []), ...action.items];
            await updateBin(action.bin_id, { items: newItems });
            break;
          }
          case 'remove_items': {
            const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
            const remaining = (bin.items || []).filter(
              (item) => !action.items.some((r) => r.toLowerCase() === item.toLowerCase())
            );
            await updateBin(action.bin_id, { items: remaining });
            break;
          }
          case 'modify_item': {
            const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
            const modified = (bin.items || []).map((item) =>
              item.toLowerCase() === action.old_item.toLowerCase() ? action.new_item : item
            );
            await updateBin(action.bin_id, { items: modified });
            break;
          }
          case 'create_bin': {
            let areaId: string | null = null;
            if (action.area_name) {
              const existing = areas.find(
                (a) => a.name.toLowerCase() === action.area_name!.toLowerCase()
              );
              if (existing) {
                areaId = existing.id;
              } else {
                const newArea = await createArea(activeLocationId, action.area_name);
                areaId = newArea.id;
              }
            }
            await addBin({
              name: action.name,
              locationId: activeLocationId,
              items: action.items,
              tags: action.tags,
              notes: action.notes,
              areaId,
              icon: action.icon,
              color: action.color,
            });
            break;
          }
          case 'delete_bin': {
            const deleted = await deleteBin(action.bin_id);
            showToast({
              message: `Deleted "${action.bin_name}"`,
              action: {
                label: 'Undo',
                onClick: () => restoreBin(deleted),
              },
            });
            break;
          }
          case 'add_tags': {
            const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
            const merged = [...new Set([...(bin.tags || []), ...action.tags])];
            await updateBin(action.bin_id, { tags: merged });
            break;
          }
          case 'remove_tags': {
            const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
            const filtered = (bin.tags || []).filter(
              (t) => !action.tags.some((r) => r.toLowerCase() === t.toLowerCase())
            );
            await updateBin(action.bin_id, { tags: filtered });
            break;
          }
          case 'modify_tag': {
            const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
            const renamed = (bin.tags || []).map((t) =>
              t.toLowerCase() === action.old_tag.toLowerCase() ? action.new_tag : t
            );
            await updateBin(action.bin_id, { tags: renamed });
            break;
          }
          case 'set_area': {
            let areaId = action.area_id;
            if (!areaId && action.area_name) {
              const existing = areas.find(
                (a) => a.name.toLowerCase() === action.area_name.toLowerCase()
              );
              if (existing) {
                areaId = existing.id;
              } else {
                const newArea = await createArea(activeLocationId, action.area_name);
                areaId = newArea.id;
              }
            }
            await updateBin(action.bin_id, { areaId });
            break;
          }
          case 'set_notes': {
            if (action.mode === 'clear') {
              await updateBin(action.bin_id, { notes: '' });
            } else if (action.mode === 'append') {
              const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
              const appended = bin.notes ? `${bin.notes}\n${action.notes}` : action.notes;
              await updateBin(action.bin_id, { notes: appended });
            } else {
              await updateBin(action.bin_id, { notes: action.notes });
            }
            break;
          }
          case 'set_icon':
            await updateBin(action.bin_id, { icon: action.icon });
            break;
          case 'set_color':
            await updateBin(action.bin_id, { color: action.color });
            break;
        }
        completed++;
      } catch (err) {
        console.error(`Failed to execute action ${action.type}:`, err);
      }
    }

    setIsExecuting(false);
    setExecutingProgress({ current: 0, total: 0 });
    notifyBinsChanged();

    if (completed === selected.length) {
      showToast({ message: `${completed} action${completed !== 1 ? 's' : ''} completed` });
    } else {
      showToast({ message: `${completed} of ${selected.length} actions completed` });
    }

    // Reset and close
    setText('');
    clearCommand();
    setCheckedActions(new Map());
    onOpenChange(false);
  }, [actions, checkedActions, activeLocationId, areas, clearCommand, onOpenChange, showToast]);

  function handleClose(v: boolean) {
    if (!v) {
      setText('');
      clearCommand();
      setCheckedActions(new Map());
    }
    onOpenChange(v);
  }

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
  const shortcutHint = isMac ? '\u2318Enter' : 'Ctrl+Enter';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask AI</DialogTitle>
        </DialogHeader>

        {state === 'preview' && actions ? (
          <div className="space-y-4">
            {interpretation && (
              <p className="text-[13px] text-[var(--text-secondary)] italic">
                {interpretation}
              </p>
            )}

            {actions.length === 0 ? (
              <p className="text-[14px] text-[var(--text-tertiary)] py-4 text-center">
                No matching bins found, or the command was ambiguous. Try using exact bin names.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {actions.map((action, i) => {
                  const checked = checkedActions.get(i) !== false;
                  const Icon = getActionIcon(action);
                  const destructive = isDestructiveAction(action);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => toggleAction(i)}
                        className="flex items-start gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 hover:bg-[var(--bg-active)] transition-colors cursor-pointer w-full text-left"
                      >
                        <span
                          className={`shrink-0 mt-0.5 h-4.5 w-4.5 rounded border flex items-center justify-center transition-colors ${
                            checked
                              ? destructive
                                ? 'bg-[var(--destructive)] border-[var(--destructive)]'
                                : 'bg-[var(--accent)] border-[var(--accent)]'
                              : 'border-[var(--border-primary)] bg-transparent'
                          }`}
                        >
                          {checked && <Check className="h-3 w-3 text-white" />}
                        </span>
                        <Icon className={cn(
                          'h-4 w-4 shrink-0 mt-0.5',
                          !checked
                            ? 'text-[var(--text-tertiary)]'
                            : destructive
                              ? 'text-[var(--destructive)]'
                              : 'text-[var(--text-secondary)]'
                        )} />
                        <span className={cn(
                          'text-[14px] leading-snug',
                          !checked
                            ? 'text-[var(--text-tertiary)] line-through'
                            : destructive
                              ? 'text-[var(--destructive)]'
                              : 'text-[var(--text-primary)]'
                        )}>
                          {describeAction(action)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="rounded-[var(--radius-full)]"
              >
                <ChevronLeft className="h-4 w-4 mr-0.5" />
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={executeActions}
                disabled={selectedCount === 0 || isExecuting}
                className="flex-1 rounded-[var(--radius-full)]"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Executing {executingProgress.current} of {executingProgress.total}...
                  </>
                ) : (
                  <>Execute {selectedCount} Action{selectedCount !== 1 ? 's' : ''}</>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What would you like to do?"
              rows={3}
              className="min-h-[80px] bg-[var(--bg-elevated)]"
              disabled={state === 'parsing' || state === 'executing'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleParse();
                }
              }}
            />

            {/* Examples and keyboard shortcut */}
            <div className="space-y-2">
              <div className="text-[12px] text-[var(--text-tertiary)] leading-relaxed space-y-1.5">
                <p className="font-medium text-[var(--text-secondary)]">Examples:</p>
                <div className="grid gap-1">
                  <p><span className="text-[var(--text-secondary)]">Add/remove items</span> — "Add screwdriver to the tools bin" or "Remove batteries from kitchen box"</p>
                  <p><span className="text-[var(--text-secondary)]">Organize</span> — "Move batteries from kitchen to garage" or "Tag tools bin as hardware"</p>
                  <p><span className="text-[var(--text-secondary)]">Manage bins</span> — "Create a bin called Holiday Decorations in the attic" or "Delete the empty box bin"</p>
                </div>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-active)] text-[var(--text-secondary)] font-mono text-[10px]">{shortcutHint}</kbd> to send
              </p>
            </div>

            {error && (
              <p className="text-[13px] text-[var(--destructive)]">{error}</p>
            )}

            {/* Inline AI setup section */}
            {!aiSettingsLoading && !isAiReady && (
              <InlineAiSetup
                expanded={aiExpanded}
                onExpandedChange={setAiExpanded}
                setup={setup}
              />
            )}

            {/* AI configured indicator (after inline setup) */}
            {!aiSettingsLoading && !settings && setup.configured && (
              <AiConfiguredIndicator />
            )}

            <Button
              type="button"
              onClick={handleParse}
              disabled={!text.trim() || state === 'parsing' || state === 'executing'}
              className="w-full rounded-[var(--radius-full)]"
            >
              {state === 'parsing' ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : state === 'executing' ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1.5" />
              )}
              {state === 'parsing' ? 'Understanding...' : state === 'executing' ? 'Executing...' : 'Send'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

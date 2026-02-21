import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Loader2, ChevronLeft, Check, Plus, Minus, Package, Trash2,
  Tag, MapPin, FileText, Palette, Image as ImageIcon, ChevronRight, Search, ImagePlus, ChevronDown,
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
import { PhotoBulkAdd } from './PhotoBulkAdd';
import { addBin, updateBin, deleteBin, restoreBin, notifyBinsChanged, addItemsToBin } from '@/features/bins/useBins';
import { useAreaList, createArea } from '@/features/areas/useAreas';
import { apiFetch } from '@/lib/api';
import { queryInventoryText, mapCommandErrorMessage, type QueryResult } from './useInventoryQuery';
import { useTerminology, type Terminology } from '@/lib/terminology';
import type { Bin } from '@/types';

interface CommandInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type State = 'idle' | 'parsing' | 'preview' | 'executing' | 'querying' | 'query-result';

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

function describeAction(action: CommandAction, t: Terminology): string {
  switch (action.type) {
    case 'add_items':
      return `Add ${action.items.join(', ')} to "${action.bin_name}"`;
    case 'remove_items':
      return `Remove ${action.items.join(', ')} from "${action.bin_name}"`;
    case 'modify_item':
      return `Rename "${action.old_item}" to "${action.new_item}" in "${action.bin_name}"`;
    case 'create_bin': {
      let desc = `Create ${t.bin} "${action.name}"`;
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
      return `Move "${action.bin_name}" to ${t.area} "${action.area_name}"`;
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
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const navigate = useNavigate();
  const { settings, isLoading: aiSettingsLoading } = useAiSettings();
  const { showToast } = useToast();
  const { areas } = useAreaList(activeLocationId);
  const { actions, interpretation, isParsing, error, parse, clearCommand } = useCommand();
  const [text, setText] = useState('');
  const [checkedActions, setCheckedActions] = useState<Map<number, boolean>>(new Map());
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingProgress, setExecutingProgress] = useState({ current: 0, total: 0 });
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [photoMode, setPhotoMode] = useState(false);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline AI setup
  const [aiExpanded, setAiExpanded] = useState(false);
  const setup = useAiProviderSetup({ onSaveSuccess: () => setAiExpanded(false) });

  const state: State = isExecuting ? 'executing' : isParsing ? 'parsing' : isQuerying ? 'querying' : queryResult ? 'query-result' : actions ? 'preview' : 'idle';

  const isAiReady = settings !== null || setup.configured;

  async function handleParse() {
    if (!text.trim() || !activeLocationId) return;
    if (!isAiReady) {
      setAiExpanded(true);
      return;
    }
    const result = await parse({ text: text.trim(), locationId: activeLocationId });
    if (result?.actions) {
      if (result.actions.length === 0) {
        // No actions — fall back to inventory query
        clearCommand();
        setIsQuerying(true);
        try {
          const qr = await queryInventoryText({ question: text.trim(), locationId: activeLocationId });
          setQueryResult(qr);
        } catch (err) {
          setQueryResult(null);
          showToast({ message: mapCommandErrorMessage(err) });
        } finally {
          setIsQuerying(false);
        }
      } else {
        const initial = new Map<number, boolean>();
        result.actions.forEach((_, i) => initial.set(i, true));
        setCheckedActions(initial);
      }
    }
  }

  function handleBack() {
    clearCommand();
    setCheckedActions(new Map());
    setQueryResult(null);
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
            await addItemsToBin(action.bin_id, action.items);
            break;
          }
          case 'remove_items': {
            const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
            const remaining = (bin.items || []).filter(
              (item) => !action.items.some((r) => r.toLowerCase() === item.name.toLowerCase())
            );
            await updateBin(action.bin_id, { items: remaining.map((i) => i.name) });
            break;
          }
          case 'modify_item': {
            const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
            const modified = (bin.items || []).map((item) =>
              item.name.toLowerCase() === action.old_item.toLowerCase() ? action.new_item : item.name
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
      setQueryResult(null);
      setPhotoMode(false);
      setInitialFiles([]);
    }
    onOpenChange(v);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setInitialFiles(Array.from(files));
    setPhotoMode(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleBinClick(binId: string) {
    handleClose(false);
    navigate(`/bin/${binId}`, { state: { backLabel: t.Bins, backPath: '/bins' } });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{photoMode ? 'Add from Photos' : 'Ask AI'}</DialogTitle>
        </DialogHeader>

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />

        {photoMode ? (
          <PhotoBulkAdd
            initialFiles={initialFiles}
            onClose={() => handleClose(false)}
            onBack={() => { setPhotoMode(false); setInitialFiles([]); }}
          />
        ) : state === 'querying' ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
            <p className="text-[14px] text-[var(--text-secondary)]">Searching your inventory...</p>
          </div>
        ) : state === 'query-result' && queryResult ? (
          <div className="space-y-4">
            <p className="text-[14px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
              {queryResult.answer}
            </p>

            {queryResult.matches.length > 0 && (
              <div className="space-y-2">
                {queryResult.matches.map((match) => (
                  <button
                    key={match.bin_id}
                    type="button"
                    onClick={() => handleBinClick(match.bin_id)}
                    className="glass-card w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-active)] transition-colors cursor-pointer rounded-[var(--radius-sm)]"
                  >
                    <Search className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[var(--text-primary)] truncate">{match.name}</p>
                      {match.area_name && (
                        <p className="text-[12px] text-[var(--text-tertiary)]">{match.area_name}</p>
                      )}
                      {match.items.length > 0 && (
                        <p className="text-[12px] text-[var(--text-secondary)] truncate">{match.items.join(', ')}</p>
                      )}
                      {match.relevance && (
                        <p className="text-[11px] text-[var(--text-tertiary)] italic mt-0.5">{match.relevance}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                  </button>
                ))}
              </div>
            )}

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
          </div>
        ) : state === 'preview' && actions ? (
          <div className="space-y-4">
            {interpretation && (
              <p className="text-[13px] text-[var(--text-secondary)] italic">
                {interpretation}
              </p>
            )}

            {actions.length === 0 ? (
              <p className="text-[14px] text-[var(--text-tertiary)] py-4 text-center">
                No matching {t.bins} found, or the command was ambiguous. Try using exact {t.bin} names.
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
                          {describeAction(action, t)}
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
            <div className="relative">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What would you like to do?"
                rows={3}
                className="min-h-[80px] bg-[var(--bg-elevated)] pr-12"
                disabled={state === 'parsing' || state === 'executing'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleParse();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute right-2.5 bottom-2.5 p-1.5 rounded-full text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors"
                title={`Upload photos to auto-create ${t.bins} with AI`}
                aria-label="Upload photos"
              >
                <ImagePlus className="h-5 w-5" />
              </button>
            </div>

            {/* Collapsible examples */}
            <div className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
              <button
                type="button"
                onClick={() => setExamplesOpen((v) => !v)}
                className="flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !examplesOpen && '-rotate-90')} />
                Examples
              </button>
              {examplesOpen && (
                <div className="grid gap-1 mt-1.5">
                  <p><span className="text-[var(--text-secondary)]">Add/remove items</span> — "Add screwdriver to the tools bin" or "Remove batteries from kitchen box"</p>
                  <p><span className="text-[var(--text-secondary)]">Organize</span> — "Move batteries from kitchen to garage" or "Tag tools bin as hardware"</p>
                  <p><span className="text-[var(--text-secondary)]">Manage {t.bins}</span> — "Create a {t.bin} called Holiday Decorations in the attic" or "Delete the empty box {t.bin}"</p>
                  <p><span className="text-[var(--text-secondary)]">Find things</span> — "Where is the glass cleaner?" or "Which {t.bins} have batteries?"</p>
                  <p><span className="text-[var(--text-secondary)]">Upload photos</span> — Snap a photo of a {t.bin} and AI will create it for you</p>
                </div>
              )}
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
              className="w-full rounded-[var(--radius-full)] bg-[var(--ai-accent)] hover:bg-[var(--ai-accent-hover)]"
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

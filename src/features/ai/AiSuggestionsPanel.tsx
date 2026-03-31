import { Check, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { AiSuggestedItem, AiSuggestions, BinItem, CustomField } from '@/types';

export type AiSuggestionChanges = Partial<{ name: string; items: AiSuggestedItem[]; tags: string[]; notes: string; customFields: Record<string, string> }>;

function nameChanged(prev: AiSuggestions | null | undefined, suggestions: AiSuggestions): boolean {
  if (!prev) return false;
  return prev.name !== suggestions.name;
}

function itemsChanged(prev: AiSuggestions | null | undefined, suggestions: AiSuggestions): boolean {
  if (!prev) return false;
  const prevNames = prev.items.map((i) => `${i.name}:${i.quantity ?? ''}`).sort().join(',');
  const newNames = suggestions.items.map((i) => `${i.name}:${i.quantity ?? ''}`).sort().join(',');
  return prevNames !== newNames;
}

function tagsChanged(prev: AiSuggestions | null | undefined, suggestions: AiSuggestions): boolean {
  if (!prev) return false;
  return prev.tags.slice().sort().join(',') !== suggestions.tags.slice().sort().join(',');
}

function notesChanged(prev: AiSuggestions | null | undefined, suggestions: AiSuggestions): boolean {
  if (!prev) return false;
  return prev.notes !== suggestions.notes;
}

interface AiSuggestionsPanelProps {
  suggestions: AiSuggestions;
  previousResult?: AiSuggestions | null;
  currentName: string;
  currentItems: BinItem[];
  currentTags: string[];
  currentNotes: string;
  customFieldDefs?: CustomField[];
  currentCustomFields?: Record<string, string>;
  onApply: (changes: AiSuggestionChanges) => void;
  onDismiss: () => void;
}

export function AiSuggestionsPanel({
  suggestions,
  previousResult,
  currentName,
  currentItems,
  currentTags,
  currentNotes,
  customFieldDefs,
  currentCustomFields,
  onApply,
  onDismiss,
}: AiSuggestionsPanelProps) {
  const isReanalysis = !!previousResult;
  const nameDidChange = isReanalysis && nameChanged(previousResult, suggestions);
  const itemsDidChange = isReanalysis && itemsChanged(previousResult, suggestions);
  const tagsDidChange = isReanalysis && tagsChanged(previousResult, suggestions);
  const notesDidChange = isReanalysis && notesChanged(previousResult, suggestions);
  const [acceptName, setAcceptName] = useState(true);
  const [acceptItems, setAcceptItems] = useState(true);
  const [acceptTags, setAcceptTags] = useState(true);
  const [acceptNotes, setAcceptNotes] = useState(true);
  const [acceptCustomFields, setAcceptCustomFields] = useState(true);

  const hasName = !!suggestions.name;
  const hasItems = suggestions.items.length > 0;
  const hasTags = suggestions.tags.length > 0;
  const hasNotes = !!suggestions.notes;

  // Map AI-suggested custom fields (by name) to field IDs
  const suggestedCfEntries = (() => {
    if (!suggestions.customFields || !customFieldDefs?.length) return [];
    const nameToField = new Map(customFieldDefs.map((f) => [f.name.toLowerCase(), f]));
    return Object.entries(suggestions.customFields)
      .map(([name, value]) => {
        const field = nameToField.get(name.toLowerCase());
        return field && value ? { field, value } : null;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
  })();
  const hasCustomFields = suggestedCfEntries.length > 0;

  function handleApply() {
    const changes: AiSuggestionChanges = {};
    if (acceptName && hasName) changes.name = suggestions.name;
    if (acceptItems && hasItems) changes.items = suggestions.items;
    if (acceptTags && hasTags) {
      const merged = Array.from(new Set([...currentTags, ...suggestions.tags]));
      changes.tags = merged;
    }
    if (acceptNotes && hasNotes) changes.notes = suggestions.notes;
    if (acceptCustomFields && hasCustomFields) {
      const merged = { ...(currentCustomFields ?? {}) };
      for (const entry of suggestedCfEntries) {
        merged[entry.field.id] = entry.value;
      }
      changes.customFields = merged;
    }
    onApply(changes);
  }

  const anySelected = (acceptName && hasName) || (acceptItems && hasItems) || (acceptTags && hasTags) || (acceptNotes && hasNotes) || (acceptCustomFields && hasCustomFields);

  return (
    <Card className="border-t-2 border-t-[var(--accent)]">
      <CardContent className="space-y-4">
        <div>
          <Label>AI Suggestions</Label>
          {isReanalysis ? (
            <div className="flex items-center gap-1.5 mt-1 text-[13px] text-[var(--accent)]">
              <RefreshCw className="h-3 w-3" />
              <span>Reanalysis complete — compare with previous results</span>
            </div>
          ) : (
            <p className="text-[13px] text-[var(--text-tertiary)] mt-0.5">
              Select which suggestions to apply to this bin.
            </p>
          )}
        </div>

        {/* Name */}
        {hasName && (
          <button type="button" onClick={() => setAcceptName(!acceptName)} className={cn(
            'flex items-start gap-3 cursor-pointer text-left w-full',
            nameDidChange && 'border-l-2 border-l-[var(--accent)] pl-3',
          )}>
            <span className={cn(
              'shrink-0 mt-1 h-4 w-4 rounded border flex items-center justify-center transition-colors',
              acceptName ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-primary)] bg-transparent',
            )}>
              {acceptName && <Check className="h-3 w-3 text-white" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-medium text-[var(--text-secondary)]">Name</p>
                {nameDidChange && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Changed</Badge>
                )}
              </div>
              <p className="text-[15px] text-[var(--text-primary)] font-semibold">{suggestions.name}</p>
              <p className="text-[12px] text-[var(--text-tertiary)]">Current: {currentName}</p>
            </div>
          </button>
        )}

        {/* Items */}
        {hasItems && (
          <button type="button" onClick={() => setAcceptItems(!acceptItems)} className={cn(
            'flex items-start gap-3 cursor-pointer text-left w-full',
            itemsDidChange && 'border-l-2 border-l-[var(--accent)] pl-3',
          )}>
            <span className={cn(
              'shrink-0 mt-1 h-4 w-4 rounded border flex items-center justify-center transition-colors',
              acceptItems ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-primary)] bg-transparent',
            )}>
              {acceptItems && <Check className="h-3 w-3 text-white" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-medium text-[var(--text-secondary)]">Items</p>
                {itemsDidChange && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Changed</Badge>
                )}
              </div>
              <ul className="mt-1 space-y-0.5">
                {suggestions.items.map((item, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: items may contain duplicates
                  <li key={i} className="text-[14px] text-[var(--text-primary)] flex items-start gap-1.5">
                    <span className="text-[var(--text-tertiary)]">•</span>
                    {item.quantity ? `${item.name} (×${item.quantity})` : item.name}
                  </li>
                ))}
              </ul>
              {currentItems.length > 0 && (
                <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                  Will replace current {currentItems.length} item{currentItems.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </button>
        )}

        {/* Tags */}
        {hasTags && (
          <button type="button" onClick={() => setAcceptTags(!acceptTags)} className={cn(
            'flex items-start gap-3 cursor-pointer text-left w-full',
            tagsDidChange && 'border-l-2 border-l-[var(--accent)] pl-3',
          )}>
            <span className={cn(
              'shrink-0 mt-1 h-4 w-4 rounded border flex items-center justify-center transition-colors',
              acceptTags ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-primary)] bg-transparent',
            )}>
              {acceptTags && <Check className="h-3 w-3 text-white" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-medium text-[var(--text-secondary)]">Tags</p>
                {tagsDidChange && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Changed</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {suggestions.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
              {currentTags.length > 0 && (
                <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                  Will add to existing tags
                </p>
              )}
            </div>
          </button>
        )}

        {/* Notes */}
        {hasNotes && (
          <button type="button" onClick={() => setAcceptNotes(!acceptNotes)} className={cn(
            'flex items-start gap-3 cursor-pointer text-left w-full',
            notesDidChange && 'border-l-2 border-l-[var(--accent)] pl-3',
          )}>
            <span className={cn(
              'shrink-0 mt-1 h-4 w-4 rounded border flex items-center justify-center transition-colors',
              acceptNotes ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-primary)] bg-transparent',
            )}>
              {acceptNotes && <Check className="h-3 w-3 text-white" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-medium text-[var(--text-secondary)]">Notes</p>
                {notesDidChange && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Changed</Badge>
                )}
              </div>
              <p className="text-[14px] text-[var(--text-primary)] whitespace-pre-wrap mt-0.5">{suggestions.notes}</p>
              {currentNotes && (
                <p className="text-[12px] text-[var(--text-tertiary)] mt-1">Will replace current notes</p>
              )}
            </div>
          </button>
        )}

        {/* Custom Fields */}
        {hasCustomFields && (
          <button type="button" onClick={() => setAcceptCustomFields(!acceptCustomFields)} className="flex items-start gap-3 cursor-pointer text-left w-full">
            <span className={cn(
              'shrink-0 mt-1 h-4 w-4 rounded border flex items-center justify-center transition-colors',
              acceptCustomFields ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-primary)] bg-transparent',
            )}>
              {acceptCustomFields && <Check className="h-3 w-3 text-white" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--text-secondary)]">Custom Fields</p>
              <div className="mt-1 space-y-1">
                {suggestedCfEntries.map((entry) => (
                  <p key={entry.field.id} className="text-[14px] text-[var(--text-primary)]">
                    <span className="text-[var(--text-tertiary)]">{entry.field.name}:</span>{' '}
                    {entry.value}
                  </p>
                ))}
              </div>
            </div>
          </button>
        )}

        {/* Buttons */}
        <div className="flex gap-2 justify-end pt-1">
          <Button
            variant="ghost"
            onClick={onDismiss}
          >
            Dismiss
          </Button>
          <Button
            onClick={handleApply}
            disabled={!anySelected}
          >
            Apply Selected
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

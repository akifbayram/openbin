import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { AiSuggestions, BinItem } from '@/types';

interface AiSuggestionsPanelProps {
  suggestions: AiSuggestions;
  currentName: string;
  currentItems: BinItem[];
  currentTags: string[];
  currentNotes: string;
  onApply: (changes: Partial<{ name: string; items: string[]; tags: string[]; notes: string }>) => void;
  onDismiss: () => void;
}

export function AiSuggestionsPanel({
  suggestions,
  currentName,
  currentItems,
  currentTags,
  currentNotes,
  onApply,
  onDismiss,
}: AiSuggestionsPanelProps) {
  const [acceptName, setAcceptName] = useState(true);
  const [acceptItems, setAcceptItems] = useState(true);
  const [acceptTags, setAcceptTags] = useState(true);
  const [acceptNotes, setAcceptNotes] = useState(true);

  const hasName = !!suggestions.name;
  const hasItems = suggestions.items.length > 0;
  const hasTags = suggestions.tags.length > 0;
  const hasNotes = !!suggestions.notes;

  function handleApply() {
    const changes: Partial<{ name: string; items: string[]; tags: string[]; notes: string }> = {};
    if (acceptName && hasName) changes.name = suggestions.name;
    if (acceptItems && hasItems) changes.items = suggestions.items;
    if (acceptTags && hasTags) {
      // Merge: union of existing + suggested
      const merged = Array.from(new Set([...currentTags, ...suggestions.tags]));
      changes.tags = merged;
    }
    if (acceptNotes && hasNotes) changes.notes = suggestions.notes;
    onApply(changes);
  }

  const anySelected = (acceptName && hasName) || (acceptItems && hasItems) || (acceptTags && hasTags) || (acceptNotes && hasNotes);

  return (
    <Card className="border-t-2 border-t-[var(--accent)]">
      <CardContent className="space-y-4">
        <div>
          <Label>AI Suggestions</Label>
          <p className="text-[13px] text-[var(--text-tertiary)] mt-0.5">
            Select which suggestions to apply to this bin.
          </p>
        </div>

        {/* Name */}
        {hasName && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptName}
              onChange={(e) => setAcceptName(e.target.checked)}
              className="mt-1 accent-[var(--accent)]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--text-secondary)]">Name</p>
              <p className="text-[15px] text-[var(--text-primary)] font-semibold">{suggestions.name}</p>
              <p className="text-[12px] text-[var(--text-tertiary)]">Current: {currentName}</p>
            </div>
          </label>
        )}

        {/* Items */}
        {hasItems && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptItems}
              onChange={(e) => setAcceptItems(e.target.checked)}
              className="mt-1 accent-[var(--accent)]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--text-secondary)]">Items</p>
              <ul className="mt-1 space-y-0.5">
                {suggestions.items.map((item, i) => (
                  <li key={i} className="text-[14px] text-[var(--text-primary)] flex items-start gap-1.5">
                    <span className="text-[var(--text-tertiary)]">•</span>
                    {item}
                  </li>
                ))}
              </ul>
              {currentItems.length > 0 && (
                <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                  Will replace current {currentItems.length} item{currentItems.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </label>
        )}

        {/* Tags */}
        {hasTags && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptTags}
              onChange={(e) => setAcceptTags(e.target.checked)}
              className="mt-1 accent-[var(--accent)]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--text-secondary)]">Tags</p>
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
          </label>
        )}

        {/* Notes */}
        {hasNotes && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptNotes}
              onChange={(e) => setAcceptNotes(e.target.checked)}
              className="mt-1 accent-[var(--accent)]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--text-secondary)]">Notes</p>
              <p className="text-[14px] text-[var(--text-primary)] whitespace-pre-wrap mt-0.5">{suggestions.notes}</p>
              {currentNotes && (
                <p className="text-[12px] text-[var(--text-tertiary)] mt-1">Will replace current notes</p>
              )}
            </div>
          </label>
        )}

        {/* Buttons */}
        <div className="flex gap-2 justify-end pt-1">
          <Button
            variant="ghost"
            onClick={onDismiss}
            className="rounded-[var(--radius-full)]"
          >
            Dismiss
          </Button>
          <Button
            onClick={handleApply}
            disabled={!anySelected}
            className="rounded-[var(--radius-full)]"
          >
            Apply Selected
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

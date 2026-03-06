import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@chakra-ui/react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { AiSuggestions, BinItem, CustomField } from '@/types';

interface AiSuggestionsPanelProps {
  suggestions: AiSuggestions;
  currentName: string;
  currentItems: BinItem[];
  currentTags: string[];
  currentNotes: string;
  customFieldDefs?: CustomField[];
  currentCustomFields?: Record<string, string>;
  onApply: (changes: Partial<{ name: string; items: string[]; tags: string[]; notes: string; customFields: Record<string, string> }>) => void;
  onDismiss: () => void;
}

export function AiSuggestionsPanel({
  suggestions,
  currentName,
  currentItems,
  currentTags,
  currentNotes,
  customFieldDefs,
  currentCustomFields,
  onApply,
  onDismiss,
}: AiSuggestionsPanelProps) {
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
    const changes: Partial<{ name: string; items: string[]; tags: string[]; notes: string; customFields: Record<string, string> }> = {};
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
    <Card className="border-t-2 border-t-purple-600 dark:border-t-purple-500">
      <CardContent className="space-y-4">
        <div>
          <Label>AI Suggestions</Label>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
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
              className="mt-1 accent-purple-600 dark:accent-purple-500"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Name</p>
              <p className="text-[15px] font-semibold">{suggestions.name}</p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400">Current: {currentName}</p>
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
              className="mt-1 accent-purple-600 dark:accent-purple-500"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Items</p>
              <ul className="mt-1 space-y-0.5">
                {suggestions.items.map((item, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: items may contain duplicates
                  <li key={i} className="text-[14px] flex items-start gap-1.5">
                    <span className="text-gray-500 dark:text-gray-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
              {currentItems.length > 0 && (
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
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
              className="mt-1 accent-purple-600 dark:accent-purple-500"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Tags</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {suggestions.tags.map((tag) => (
                  <Badge key={tag} variant="ghost">{tag}</Badge>
                ))}
              </div>
              {currentTags.length > 0 && (
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
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
              className="mt-1 accent-purple-600 dark:accent-purple-500"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Notes</p>
              <p className="text-[14px] whitespace-pre-wrap mt-0.5">{suggestions.notes}</p>
              {currentNotes && (
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">Will replace current notes</p>
              )}
            </div>
          </label>
        )}

        {/* Custom Fields */}
        {hasCustomFields && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptCustomFields}
              onChange={(e) => setAcceptCustomFields(e.target.checked)}
              className="mt-1 accent-purple-600 dark:accent-purple-500"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Custom Fields</p>
              <div className="mt-1 space-y-1">
                {suggestedCfEntries.map((entry) => (
                  <p key={entry.field.id} className="text-[14px]">
                    <span className="text-gray-500 dark:text-gray-400">{entry.field.name}:</span>{' '}
                    {entry.value}
                  </p>
                ))}
              </div>
            </div>
          </label>
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

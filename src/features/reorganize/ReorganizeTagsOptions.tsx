import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OptionGroup } from '@/components/ui/option-group';
import { Textarea } from '@/components/ui/textarea';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { TagSuggestOptions } from './useReorganizeTags';

interface Props {
  changeLevel: NonNullable<TagSuggestOptions['changeLevel']>;
  granularity: NonNullable<TagSuggestOptions['granularity']>;
  maxTagsPerBin: string;
  userNotes: string;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
  onChangeLevelChange: (v: NonNullable<TagSuggestOptions['changeLevel']>) => void;
  onGranularityChange: (v: NonNullable<TagSuggestOptions['granularity']>) => void;
  onMaxTagsChange: (v: string) => void;
  onUserNotesChange: (v: string) => void;
}

const changeLevelHints: Record<string, string> = {
  additive: "Only add tags — don't rename or remove",
  moderate: 'Also rename and merge duplicates, propose parents',
  full: "Also remove tags that don't fit",
};

export function ReorganizeTagsOptions(props: Props) {
  const t = useTerminology();
  const {
    changeLevel,
    granularity,
    maxTagsPerBin,
    userNotes,
    expanded,
    onExpandedChange,
    onChangeLevelChange,
    onGranularityChange,
    onMaxTagsChange,
    onUserNotesChange,
  } = props;

  return (
    <>
      <button
        type="button"
        className="row-spread w-full"
        aria-expanded={expanded}
        aria-controls="reorganize-tags-options"
        onClick={() => onExpandedChange(!expanded)}
      >
        <div className="row">
          <SlidersHorizontal className="h-4 w-4 text-[var(--text-tertiary)]" />
          <Label className="text-[15px] font-semibold text-[var(--text-primary)] pointer-events-none">
            Options
          </Label>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      <div
        id="reorganize-tags-options"
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="mt-3 space-y-4">
            <fieldset className="border-0 p-0 m-0">
              <legend className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2 p-0">
                Change level
              </legend>
              <OptionGroup
                options={[
                  { key: 'additive', label: 'Additive' },
                  { key: 'moderate', label: 'Moderate' },
                  { key: 'full', label: 'Full' },
                ]}
                value={changeLevel}
                onChange={onChangeLevelChange as (v: string) => void}
                size="sm"
              />
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
                {changeLevelHints[changeLevel]}
              </p>
            </fieldset>

            <fieldset className="border-0 p-0 m-0">
              <legend className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2 p-0">
                Tag granularity
              </legend>
              <OptionGroup
                options={[
                  { key: 'broad', label: 'Broad' },
                  { key: 'medium', label: 'Medium' },
                  { key: 'specific', label: 'Specific' },
                ]}
                value={granularity}
                onChange={onGranularityChange as (v: string) => void}
                size="sm"
              />
            </fieldset>

            <div>
              <Label
                htmlFor="tag-max"
                className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2"
              >
                Max tags per {t.bin}
              </Label>
              <Input
                id="tag-max"
                type="number"
                min={1}
                max={10}
                value={maxTagsPerBin}
                onChange={(e) => onMaxTagsChange(e.target.value)}
                placeholder="Auto"
              />
            </div>

            <div>
              <Label
                htmlFor="tag-notes"
                className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2"
              >
                Additional instructions
              </Label>
              <Textarea
                id="tag-notes"
                value={userNotes}
                onChange={(e) => onUserNotesChange(e.target.value)}
                placeholder="e.g. emphasize kitchen categories"
                rows={2}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

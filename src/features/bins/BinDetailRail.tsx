import { Check, Copy, Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { useTerminology } from '@/lib/terminology';
import { cn, focusRing, sectionHeader } from '@/lib/utils';
import type { Bin } from '@/types';
import { TagInput } from './TagInput';
import type { useAutoSaveBin } from './useAutoSaveBin';
import { VisibilityPicker } from './VisibilityPicker';

interface BinDetailRailProps {
  bin: Bin;
  autoSave: ReturnType<typeof useAutoSaveBin>;
  canEdit: boolean;
  canChangeVisibility: boolean;
  canChangeCode: boolean;
  onChangeCode: () => void;
  allTags: string[];
  activeLocationId: string | undefined;
}

const META_FIELD = 'flex flex-col gap-1';
const RAIL_ICON_BTN = cn(
  'h-11 w-11 rounded-[var(--radius-xs)] flex items-center justify-center',
  'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors',
  focusRing,
);

export function BinDetailRail({
  bin,
  autoSave,
  canEdit,
  canChangeVisibility,
  canChangeCode,
  onChangeCode,
  allTags,
  activeLocationId,
}: BinDetailRailProps) {
  const navigate = useNavigate();
  const getTagStyle = useTagStyle();
  const { showToast } = useToast();
  const t = useTerminology();
  const hasTags = bin.tags.length > 0;

  // Notes — local state synced with external bin.notes changes (e.g. AI apply)
  const [localNotes, setLocalNotes] = useState(bin.notes);
  const prevNotes = useRef(bin.notes);
  if (bin.notes !== prevNotes.current) {
    prevNotes.current = bin.notes;
    setLocalNotes(bin.notes);
  }

  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(bin.short_code);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1600);
      showToast({ message: 'Code copied' });
    } catch {
      // clipboard may be unavailable; ignore
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="sr-only">Bin details</h2>

      <div className={cn(META_FIELD, autoSave.savedFields.has('notes') && 'animate-save-flash')}>
        <label htmlFor="detail-notes" className={sectionHeader}>Notes</label>
        {canEdit ? (
          <Textarea
            id="detail-notes"
            value={localNotes}
            onChange={(e) => {
              const value = e.target.value;
              setLocalNotes(value);
              autoSave.saveNotes(value);
            }}
            maxLength={10000}
            rows={4}
            className="[field-sizing:content] min-h-[8rem] text-[15px] leading-relaxed"
            placeholder="Add notes..."
          />
        ) : bin.notes ? (
          <p className="text-[15px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
            {bin.notes}
          </p>
        ) : (
          <p className="text-[15px] text-[var(--text-tertiary)]">No notes</p>
        )}
      </div>

      <div className="flex flex-col gap-4" data-tour="bin-appearance">
        <div className={META_FIELD} data-tour="bin-qr">
          <span className={sectionHeader}>Code</span>
          <div className="flex items-center h-11 rounded-[var(--radius-sm)] border border-[var(--border-flat)] bg-[var(--bg-input)] pl-3.5 pr-1 transition-colors focus-within:ring-2 focus-within:ring-[var(--accent)]">
            <span className="flex-1 font-mono text-[15px] tracking-[0.14em] text-[var(--text-primary)] select-all truncate">
              {bin.short_code}
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              <Tooltip content={copied ? 'Copied!' : 'Copy code'}>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  aria-label="Copy code"
                  className={RAIL_ICON_BTN}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-[var(--color-success)]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </Tooltip>
              {canChangeCode && (
                <Tooltip content="Change code">
                  <button
                    type="button"
                    onClick={onChangeCode}
                    aria-label="Change code"
                    className={RAIL_ICON_BTN}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        <div className={cn(META_FIELD, autoSave.savedFields.has('areaId') && 'animate-save-flash')}>
          <span className={sectionHeader}>{t.Area}</span>
          {canEdit ? (
            <AreaPicker
              locationId={activeLocationId}
              value={bin.area_id}
              onChange={(areaId) => autoSave.saveAreaId(areaId)}
            />
          ) : (
            <p className="text-[15px] text-[var(--text-primary)]">
              {bin.area_name || <span className="text-[var(--text-tertiary)]">No area</span>}
            </p>
          )}
        </div>

        <div className={cn(META_FIELD, autoSave.savedFields.has('tags') && 'animate-save-flash')}>
          <span className={sectionHeader}>Tags</span>
          {canEdit ? (
            <TagInput
              tags={bin.tags}
              onChange={(tags) => autoSave.saveTags(tags)}
              suggestions={allTags}
            />
          ) : hasTags ? (
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {bin.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  style={getTagStyle(tag)}
                  onClick={() => navigate(`/bins?tags=${encodeURIComponent(tag)}`)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-[var(--text-tertiary)]">No tags</p>
          )}
        </div>

        {canChangeVisibility && (
          <div className={cn(META_FIELD, autoSave.savedFields.has('visibility') && 'animate-save-flash')}>
            <span className={sectionHeader}>Visibility</span>
            <VisibilityPicker
              value={bin.visibility}
              onChange={(v) => autoSave.saveVisibility(v)}
            />
          </div>
        )}
      </div>
    </section>
  );
}

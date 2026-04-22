import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { TagProposalResult, TagUserSelections } from './useReorganizeTags';

interface BinMeta {
  id: string;
  name: string;
  tags: string[];
}

interface LenientTaxonomy {
  newTags: Array<{ tag: string; parent?: string | null }>;
  renames: Array<{ from: string; to: string }>;
  merges: Array<{ from: string[]; to: string }>;
  parents: Array<{ tag: string; parent: string | null }>;
}

interface LenientProposal {
  taxonomy: LenientTaxonomy;
  assignments: Array<{ binId: string; add: string[]; remove: string[] }>;
  summary: string;
}

interface Props {
  result: TagProposalResult | null;
  partialResult: LenientProposal;
  binMap: Map<string, BinMeta>;
  isStreaming: boolean;
  isApplying: boolean;
  onAccept: () => void;
  onCancel: () => void;
  onRegenerate: () => void;
  selections: TagUserSelections;
  onSelectionsChange: (next: TagUserSelections) => void;
}

export function ReorganizeTagsPreview({
  result,
  partialResult,
  binMap,
  isStreaming,
  isApplying,
  onAccept,
  onCancel,
  onRegenerate,
  selections,
  onSelectionsChange,
}: Props) {
  const t = useTerminology();
  const effective: LenientProposal = result ?? partialResult;
  const hasTaxonomy =
    effective.taxonomy.newTags.length +
      effective.taxonomy.renames.length +
      effective.taxonomy.merges.length +
      effective.taxonomy.parents.length >
    0;
  const hasAssignments = effective.assignments.length > 0;

  if (!isStreaming && !hasTaxonomy && !hasAssignments && result) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Sparkles className="h-6 w-6 text-[var(--text-tertiary)]" />
        <p className="text-[14px] text-[var(--text-secondary)]">
          No tag changes suggested. Try a different change level or granularity.
        </p>
        <Button variant="outline" size="sm" onClick={onRegenerate}>
          Regenerate
        </Button>
      </div>
    );
  }

  function toggleSet<K extends keyof TagUserSelections>(key: K, value: string) {
    const next = new Set(selections[key]) as Set<string>;
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onSelectionsChange({ ...selections, [key]: next });
  }

  const assignmentsChecked = effective.assignments.filter((a) => selections.assignments.has(a.binId)).length;

  return (
    <div className="flex flex-col gap-4">
      {effective.summary && (
        <p className="text-[13px] text-[var(--text-tertiary)]">{effective.summary}</p>
      )}

      {hasTaxonomy && (
        <div className="flex flex-col gap-3 pb-3 border-b border-[var(--border-subtle)]">
          {effective.taxonomy.newTags.length > 0 && (
            <div>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">New tags</div>
              <div className="flex flex-wrap gap-1.5">
                {effective.taxonomy.newTags.map((n) => {
                  const checked = selections.newTags.has(n.tag);
                  return (
                    <div
                      key={n.tag}
                      className={cn('inline-flex items-center gap-1.5', !checked && 'opacity-40')}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleSet('newTags', n.tag)}
                        aria-label={`New tag ${n.tag}`}
                      />
                      <Badge variant="secondary" className="text-[13px]">
                        <span>{n.tag}</span>
                        {n.parent ? (
                          <span className="ml-1 text-[11px] opacity-70">{`← ${n.parent}`}</span>
                        ) : null}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {effective.taxonomy.renames.length > 0 && (
            <div>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Renames</div>
              <div className="flex flex-col gap-1">
                {effective.taxonomy.renames.map((r) => {
                  const key = `${r.from}->${r.to}`;
                  const checked = selections.renames.has(key);
                  return (
                    <div
                      key={key}
                      className={cn('inline-flex items-center gap-2', !checked && 'opacity-40')}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleSet('renames', key)}
                        aria-label={`Rename ${r.from} to ${r.to}`}
                      />
                      <span className="text-[13px]">{`${r.from} → ${r.to}`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {effective.taxonomy.merges.length > 0 && (
            <div>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Merges</div>
              <div className="flex flex-col gap-1">
                {effective.taxonomy.merges.map((m) => {
                  const checked = selections.merges.has(m.to);
                  return (
                    <div
                      key={m.to}
                      className={cn('inline-flex items-center gap-2', !checked && 'opacity-40')}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleSet('merges', m.to)}
                        aria-label={`Merge into ${m.to}`}
                      />
                      <span className="text-[13px]">{`${m.from.join(', ')} → ${m.to}`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {effective.taxonomy.parents.length > 0 && (
            <div>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Parent moves</div>
              <div className="flex flex-col gap-1">
                {effective.taxonomy.parents.map((p) => {
                  const key = `${p.tag}->${p.parent}`;
                  const checked = selections.parents.has(key);
                  const parentLabel = p.parent ?? '(top level)';
                  return (
                    <div
                      key={key}
                      className={cn('inline-flex items-center gap-2', !checked && 'opacity-40')}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleSet('parents', key)}
                        aria-label={`Set parent of ${p.tag} to ${parentLabel}`}
                      />
                      <span className="text-[13px]">{`${p.tag} → under ${parentLabel}`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {hasAssignments && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-medium text-[var(--text-secondary)]">
              {assignmentsChecked} of {effective.assignments.length} {t.bins} checked
            </div>
            <div className="flex items-center gap-3 text-[12px]">
              <button
                type="button"
                onClick={() =>
                  onSelectionsChange({
                    ...selections,
                    assignments: new Set(effective.assignments.map((a) => a.binId)),
                  })
                }
                className="text-[var(--accent)] hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onSelectionsChange({ ...selections, assignments: new Set() })}
                className="text-[var(--text-tertiary)] hover:underline"
              >
                Select none
              </button>
            </div>
          </div>
          <div className="flex flex-col divide-y divide-[var(--border-subtle)] max-h-[420px] overflow-y-auto">
            {effective.assignments.map((a) => {
              const bin = binMap.get(a.binId);
              const checked = selections.assignments.has(a.binId);
              return (
                <div key={a.binId} className={cn('flex items-center gap-2 py-2', !checked && 'opacity-50')}>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleSet('assignments', a.binId)}
                    aria-label={bin?.name ?? a.binId}
                  />
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                    <Link
                      to={`/bins/${a.binId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] font-medium text-[var(--text-primary)] hover:underline truncate"
                    >
                      {bin?.name ?? a.binId}
                    </Link>
                    {(bin?.tags ?? []).map((tg) => (
                      <Badge key={`exist-${tg}`} variant="outline" className="text-[11px] opacity-60">
                        {tg}
                      </Badge>
                    ))}
                    {a.add.map((tg) => (
                      <Badge key={`add-${tg}`} variant="default" className="text-[11px]">
                        + {tg}
                      </Badge>
                    ))}
                    {a.remove.map((tg) => (
                      <Badge key={`rm-${tg}`} variant="outline" className="text-[11px] line-through opacity-70">
                        {tg}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)]">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isApplying}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isApplying || isStreaming}>
            Regenerate
          </Button>
          <Button
            size="sm"
            onClick={onAccept}
            disabled={isApplying || isStreaming || (!hasTaxonomy && assignmentsChecked === 0)}
          >
            {isApplying ? 'Applying…' : 'Apply'}
          </Button>
        </div>
      </div>
    </div>
  );
}

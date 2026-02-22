import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/lib/usePermissions';
import { Clock, Package, MapPin, Users, Image, RotateCcw, Trash2, Plus, Pencil, LogIn, LogOut, UserMinus, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useActivityLog } from './useActivity';
import { useTerminology, type Terminology } from '@/lib/terminology';
import type { ActivityLogEntry } from '@/types';

function getActionIcon(entry: ActivityLogEntry) {
  const { action, entity_type } = entry;
  if (action === 'create') return <Plus className="h-3.5 w-3.5" />;
  if (action === 'update') return <Pencil className="h-3.5 w-3.5" />;
  if (action === 'delete' || action === 'permanent_delete') return <Trash2 className="h-3.5 w-3.5" />;
  if (action === 'restore') return <RotateCcw className="h-3.5 w-3.5" />;
  if (action === 'add_photo') return <Image className="h-3.5 w-3.5" />;
  if (action === 'delete_photo') return <Image className="h-3.5 w-3.5" />;
  if (action === 'move_in' || action === 'move_out') return <ArrowRightLeft className="h-3.5 w-3.5" />;
  if (action === 'join') return <LogIn className="h-3.5 w-3.5" />;
  if (action === 'leave') return <LogOut className="h-3.5 w-3.5" />;
  if (action === 'remove_member') return <UserMinus className="h-3.5 w-3.5" />;
  if (entity_type === 'area') return <MapPin className="h-3.5 w-3.5" />;
  if (entity_type === 'member') return <Users className="h-3.5 w-3.5" />;
  return <Package className="h-3.5 w-3.5" />;
}

function getActionColor(action: string): string {
  if (action === 'create') return 'text-green-500';
  if (action === 'delete' || action === 'permanent_delete') return 'text-[var(--destructive)]';
  if (action === 'restore') return 'text-[var(--accent)]';
  if (action === 'update') return 'text-amber-500';
  if (action === 'move_in' || action === 'move_out') return 'text-blue-500';
  return 'text-[var(--text-tertiary)]';
}

function getActionLabel(entry: ActivityLogEntry, t: Terminology): string {
  const name = entry.entity_name ? `"${entry.entity_name}"` : '';
  const { action, entity_type } = entry;

  if (entity_type === 'bin') {
    if (action === 'create') return `created ${t.bin} ${name}`;
    if (action === 'update') {
      const c = entry.changes;
      if (c) {
        const keys = Object.keys(c);
        const itemOnly = keys.every((k) => k === 'items_added' || k === 'items_removed' || k === 'items_renamed' || k === 'items');
        if (itemOnly) {
          const added = c.items_added ? (c.items_added.new as string[]) : [];
          const removed = c.items_removed ? (c.items_removed.old as string[]) : [];
          const renamed = c.items_renamed ? c.items_renamed : null;
          // Legacy items array diff
          let legacyAdded: string[] = [];
          let legacyRemoved: string[] = [];
          if (c.items && Array.isArray(c.items.old) && Array.isArray(c.items.new)) {
            legacyAdded = (c.items.new as string[]).filter((i) => !(c.items.old as string[]).includes(i));
            legacyRemoved = (c.items.old as string[]).filter((i) => !(c.items.new as string[]).includes(i));
          }
          const allAdded = [...added, ...legacyAdded];
          const allRemoved = [...removed, ...legacyRemoved];
          if (renamed && !allAdded.length && !allRemoved.length) {
            return `renamed ${String(renamed.old ?? '')} to ${String(renamed.new ?? '')} in ${t.bin} ${name}`;
          }
          if (allAdded.length && !allRemoved.length) {
            return `added ${allAdded.join(', ')} to ${t.bin} ${name}`;
          }
          if (allRemoved.length && !allAdded.length) {
            return `removed ${allRemoved.join(', ')} from ${t.bin} ${name}`;
          }
          if (allAdded.length && allRemoved.length) {
            return `added ${allAdded.join(', ')} and removed ${allRemoved.join(', ')} in ${t.bin} ${name}`;
          }
          // Reorder-only (legacy)
          if (c.items && !allAdded.length && !allRemoved.length) {
            return `reordered items in ${t.bin} ${name}`;
          }
        }
      }
      return `updated ${t.bin} ${name}`;
    }
    if (action === 'delete') return `deleted ${t.bin} ${name}`;
    if (action === 'restore') return `restored ${t.bin} ${name}`;
    if (action === 'permanent_delete') return `permanently deleted ${t.bin} ${name}`;
    if (action === 'move_in' || action === 'move_out') {
      const from = entry.changes?.location?.old;
      const to = entry.changes?.location?.new;
      return `moved ${t.bin} ${name} from ${from ?? '?'} to ${to ?? '?'}`;
    }
    if (action === 'add_photo') return `added photo to ${t.bin} ${name}`;
    if (action === 'delete_photo') return `removed photo from ${t.bin} ${name}`;
  }
  if (entity_type === 'area') {
    if (action === 'create') return `created ${t.area} ${name}`;
    if (action === 'update') return `renamed ${t.area} to ${name}`;
    if (action === 'delete') return `deleted ${t.area} ${name}`;
  }
  if (entity_type === 'member') {
    if (action === 'join') return `joined the ${t.location}`;
    if (action === 'leave') return `left the ${t.location}`;
    if (action === 'remove_member') return `removed ${name}`;
  }
  if (entity_type === 'location') {
    if (action === 'update') return `updated ${t.location} ${name}`;
  }

  return `${action} ${entity_type} ${name}`;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function groupByDate(entries: ActivityLogEntry[]): Map<string, ActivityLogEntry[]> {
  const groups = new Map<string, ActivityLogEntry[]>();
  for (const entry of entries) {
    const date = new Date(entry.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label: string;
    if (date.toDateString() === today.toDateString()) {
      label = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = 'Yesterday';
    } else {
      label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(entry);
  }
  return groups;
}

export function ActivityPage() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: permissionsLoading } = usePermissions();
  const t = useTerminology();
  const { entries, isLoading, hasMore, loadMore } = useActivityLog({ limit: 50 });
  const grouped = groupByDate(entries);

  useEffect(() => {
    if (!permissionsLoading && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [permissionsLoading, isAdmin, navigate]);

  if (!permissionsLoading && !isAdmin) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2 max-w-2xl mx-auto">
      <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
        Activity
      </h1>

      {(isLoading || permissionsLoading) && entries.length === 0 ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-3 w-16" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="glass-card rounded-[var(--radius-lg)] px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
          <Clock className="h-16 w-16 opacity-40" />
          <div className="text-center space-y-1.5">
            <p className="text-[17px] font-semibold text-[var(--text-secondary)]">
              No activity yet
            </p>
            <p className="text-[13px]">Actions like creating, editing, and deleting {t.bins} will appear here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([dateLabel, items]) => (
            <div key={dateLabel} className="space-y-3">
              <h2 className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                {dateLabel}
              </h2>
              <div className="space-y-3">
                {items.map((entry) => {
                  const isClickable = entry.entity_type === 'bin' && entry.entity_id && entry.action !== 'permanent_delete' && entry.action !== 'delete';
                  return (
                  <button
                    key={entry.id}
                    className={`glass-card w-full flex items-start gap-3 px-4 py-3.5 text-left rounded-[var(--radius-lg)] transition-all duration-200 ${isClickable ? 'hover:bg-[var(--bg-hover)] active:scale-[0.98] cursor-pointer' : 'cursor-default'}`}
                    onClick={() => {
                      if (isClickable) {
                        navigate(`/bin/${entry.entity_id}`, { state: { backLabel: 'Activity', backPath: '/activity' } });
                      }
                    }}
                  >
                    <div className={`h-8 w-8 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center shrink-0 ${getActionColor(entry.action)}`}>
                      {getActionIcon(entry)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-[var(--text-primary)]">
                        <span className="font-medium">{entry.display_name}</span>{' '}
                        {getActionLabel(entry, t)}
                      </p>
                      {entry.changes && (() => {
                        const ITEM_FIELDS = new Set(['items_added', 'items_removed', 'items_renamed', 'items']);
                        const SKIP_FIELDS = new Set(['location', 'area_id']);
                        const fields = Object.entries(entry.changes).filter(([f]) => !ITEM_FIELDS.has(f) && !SKIP_FIELDS.has(f));
                        if (fields.length === 0) return null;
                        return (
                          <div className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                            {fields.map(([field, diff]) => {
                              const label = field === 'area' ? t.area
                                : field === 'name' ? 'name'
                                : field === 'card_style' ? 'style'
                                : field;
                              const formatVal = (val: unknown) => {
                                if (field === 'card_style') {
                                  try {
                                    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
                                    return parsed?.variant || 'glass';
                                  } catch { return String(val || 'glass'); }
                                }
                                return String(val ?? 'none');
                              };
                              return (
                                <p key={field}>
                                  {label}: <span className="line-through">{formatVal(diff.old)}</span> → {formatVal(diff.new)}
                                </p>
                              );
                            })}
                          </div>
                        );
                      })()}
                      <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
                        {formatTime(entry.created_at)}
                        {entry.auth_method === 'api_key' && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--bg-elevated)] text-[var(--text-tertiary)]">
                            API{entry.api_key_name ? `: ${entry.api_key_name}` : ''}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                  );
                })}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                disabled={isLoading}
                className="rounded-[var(--radius-full)]"
              >
                {isLoading ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

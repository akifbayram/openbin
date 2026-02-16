import { useNavigate } from 'react-router-dom';
import { Clock, Package, MapPin, Users, Image, RotateCcw, Trash2, Plus, Pencil, LogIn, LogOut, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useActivityLog } from './useActivity';
import type { ActivityLogEntry } from '@/types';

function getActionIcon(entry: ActivityLogEntry) {
  const { action, entity_type } = entry;
  if (action === 'create') return <Plus className="h-3.5 w-3.5" />;
  if (action === 'update') return <Pencil className="h-3.5 w-3.5" />;
  if (action === 'delete' || action === 'permanent_delete') return <Trash2 className="h-3.5 w-3.5" />;
  if (action === 'restore') return <RotateCcw className="h-3.5 w-3.5" />;
  if (action === 'add_photo') return <Image className="h-3.5 w-3.5" />;
  if (action === 'delete_photo') return <Image className="h-3.5 w-3.5" />;
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
  return 'text-[var(--text-tertiary)]';
}

function getActionLabel(entry: ActivityLogEntry): string {
  const name = entry.entity_name ? `"${entry.entity_name}"` : '';
  const { action, entity_type } = entry;

  if (entity_type === 'bin') {
    if (action === 'create') return `created bin ${name}`;
    if (action === 'update') return `updated bin ${name}`;
    if (action === 'delete') return `deleted bin ${name}`;
    if (action === 'restore') return `restored bin ${name}`;
    if (action === 'permanent_delete') return `permanently deleted bin ${name}`;
    if (action === 'add_photo') return `added photo to ${name}`;
    if (action === 'delete_photo') return `removed photo from ${name}`;
  }
  if (entity_type === 'area') {
    if (action === 'create') return `created area ${name}`;
    if (action === 'update') return `renamed area to ${name}`;
    if (action === 'delete') return `deleted area ${name}`;
  }
  if (entity_type === 'member') {
    if (action === 'join') return `joined the location`;
    if (action === 'leave') return `left the location`;
    if (action === 'remove_member') return `removed ${name}`;
  }
  if (entity_type === 'location') {
    if (action === 'update') return `updated location ${name}`;
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
  const { entries, isLoading, hasMore, loadMore } = useActivityLog({ limit: 50 });
  const grouped = groupByDate(entries);

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 pb-2">
      <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
        Activity
      </h1>

      {isLoading && entries.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
          <Clock className="h-16 w-16 opacity-40" />
          <div className="text-center space-y-1.5">
            <p className="text-[17px] font-semibold text-[var(--text-secondary)]">
              No activity yet
            </p>
            <p className="text-[13px]">Actions like creating, editing, and deleting bins will appear here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([dateLabel, items]) => (
            <div key={dateLabel} className="space-y-3">
              <h2 className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                {dateLabel}
              </h2>
              <div className="space-y-0">
                {items.map((entry) => (
                  <button
                    key={entry.id}
                    className="w-full flex items-start gap-3 py-2.5 px-1 text-left hover:bg-[var(--bg-hover)] rounded-[var(--radius-md)] transition-colors"
                    onClick={() => {
                      if (entry.entity_type === 'bin' && entry.entity_id && entry.action !== 'permanent_delete') {
                        navigate(`/bin/${entry.entity_id}`);
                      }
                    }}
                  >
                    <div className={`h-8 w-8 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center shrink-0 ${getActionColor(entry.action)}`}>
                      {getActionIcon(entry)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-[var(--text-primary)]">
                        <span className="font-medium">{entry.display_name}</span>{' '}
                        {getActionLabel(entry)}
                      </p>
                      {entry.changes && (
                        <div className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                          {Object.entries(entry.changes).map(([field, diff]) => {
                            if (field === 'items_added' && Array.isArray(diff.new)) {
                              return <p key={field}>added: {(diff.new as string[]).join(', ')}</p>;
                            }
                            if (field === 'items_removed' && Array.isArray(diff.old)) {
                              return <p key={field}>removed: {(diff.old as string[]).join(', ')}</p>;
                            }
                            if (field === 'items_renamed') {
                              return <p key={field}>renamed: <span className="line-through">{String(diff.old ?? '')}</span> → {String(diff.new ?? '')}</p>;
                            }
                            // Legacy items field — compute readable diff from arrays
                            if (field === 'items' && Array.isArray(diff.old) && Array.isArray(diff.new)) {
                              const oldItems = diff.old as string[];
                              const newItems = diff.new as string[];
                              const added = newItems.filter((i) => !oldItems.includes(i));
                              const removed = oldItems.filter((i) => !newItems.includes(i));
                              if (added.length === 0 && removed.length === 0) {
                                return <p key={field}>reordered items</p>;
                              }
                              return (
                                <div key={field}>
                                  {added.length > 0 && <p>added: {added.join(', ')}</p>}
                                  {removed.length > 0 && <p>removed: {removed.join(', ')}</p>}
                                </div>
                              );
                            }
                            // Hide raw area_id UUIDs from legacy records
                            if (field === 'area_id') {
                              return null;
                            }
                            // Readable labels for known fields
                            const label = field === 'area' ? 'area'
                              : field === 'name' ? 'name'
                              : field;
                            return (
                              <p key={field}>
                                {label}: <span className="line-through">{String(diff.old ?? 'none')}</span> → {String(diff.new ?? 'none')}
                              </p>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
                        {formatTime(entry.created_at)}
                      </p>
                    </div>
                  </button>
                ))}
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

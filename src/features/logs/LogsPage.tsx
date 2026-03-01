import { ArrowDown, Circle, Pause, Play, Terminal, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { OptionGroup, type OptionGroupOption } from '@/components/ui/option-group';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/lib/usePermissions';
import { type LogEntry, useLogStream } from './useLogStream';

type LevelFilter = '' | 'info' | 'warn' | 'error';

const LEVEL_FILTERS: OptionGroupOption<LevelFilter>[] = [
  { key: '', label: 'All' },
  { key: 'error', label: 'Errors' },
  { key: 'warn', label: 'Warnings' },
  { key: 'info', label: 'Info' },
];

function levelColor(level: string): string {
  switch (level) {
    case 'error':
      return 'text-red-400';
    case 'warn':
      return 'text-amber-400';
    default:
      return 'text-emerald-400';
  }
}

function statusColor(status?: number): string {
  if (!status) return '';
  if (status >= 500) return 'text-red-400';
  if (status >= 400) return 'text-amber-400';
  if (status >= 300) return 'text-blue-400';
  return 'text-emerald-400';
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function LogLine({ entry }: { entry: LogEntry }) {
  if (entry.method) {
    return (
      <div className="flex gap-2 py-0.5 font-mono text-[13px] leading-5 hover:bg-white/5">
        <span className="text-[var(--text-tertiary)] shrink-0 tabular-nums">{formatTime(entry.timestamp)}</span>
        <span className={`shrink-0 w-7 text-right font-semibold ${levelColor(entry.level)}`}>
          {entry.level === 'error' ? 'ERR' : entry.level === 'warn' ? 'WRN' : 'INF'}
        </span>
        <span className="shrink-0 w-11 text-right font-semibold text-[var(--text-secondary)]">{entry.method}</span>
        <span className={`shrink-0 w-8 text-right ${statusColor(entry.status)}`}>{entry.status}</span>
        <span className="text-[var(--text-secondary)] shrink-0 w-14 text-right tabular-nums">
          {entry.duration != null ? `${entry.duration}ms` : ''}
        </span>
        <span className="text-[var(--text-primary)] truncate">{entry.path}</span>
      </div>
    );
  }

  return (
    <div className="flex gap-2 py-0.5 font-mono text-[13px] leading-5 hover:bg-white/5">
      <span className="text-[var(--text-tertiary)] shrink-0 tabular-nums">{formatTime(entry.timestamp)}</span>
      <span className={`shrink-0 w-7 text-right font-semibold ${levelColor(entry.level)}`}>
        {entry.level === 'error' ? 'ERR' : entry.level === 'warn' ? 'WRN' : 'INF'}
      </span>
      <span className="text-[var(--text-primary)]">{entry.message}</span>
    </div>
  );
}

export function LogsPage() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: permissionsLoading } = usePermissions();
  const { entries, connected, isLoading, clear } = useLogStream();
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('');
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    if (!permissionsLoading && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [permissionsLoading, isAdmin, navigate]);

  const filteredEntries = levelFilter
    ? entries.filter((e) => {
        if (levelFilter === 'error') return e.level === 'error';
        if (levelFilter === 'warn') return e.level === 'warn' || e.level === 'error';
        return true;
      })
    : entries;

  // Auto-scroll to bottom when new entries arrive.
  // Use rAF so the scroll happens after the browser paints the new DOM content.
  const lastEntryId = filteredEntries[filteredEntries.length - 1]?.id;
  useEffect(() => {
    if (paused || !isAtBottomRef.current || !scrollRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [lastEntryId, paused]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 40;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      isAtBottomRef.current = true;
    }
  }, []);

  if (!permissionsLoading && !isAdmin) return null;

  return (
    <div className="page-content">
      <PageHeader title="Server Logs" />

      <div className="flex items-center gap-2 flex-wrap">
        <OptionGroup options={LEVEL_FILTERS} value={levelFilter} onChange={setLevelFilter} size="sm" />
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)]">
          <Circle className={`h-2.5 w-2.5 fill-current ${connected ? 'text-emerald-400' : 'text-red-400'}`} />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume' : 'Pause'}>
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={scrollToBottom} aria-label="Scroll to bottom">
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={clear} aria-label="Clear logs">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {isLoading || permissionsLoading ? (
        <div className="glass-card rounded-[var(--radius-lg)] p-4 space-y-2">
          {Array.from({ length: 12 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : filteredEntries.length === 0 ? (
        <EmptyState
          icon={Terminal}
          title="No log entries"
          subtitle="Entries will appear here as requests are made to the server"
        />
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="glass-card rounded-[var(--radius-lg)] p-3 overflow-auto bg-[color-mix(in_srgb,var(--bg-base),black_30%)]"
          style={{ maxHeight: 'calc(100dvh - 240px)' }}
        >
          {filteredEntries.map((entry) => (
            <LogLine key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

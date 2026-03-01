const MAX_ENTRIES = 1000;

export interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  method?: string;
  path?: string;
  status?: number;
  duration?: number;
  ip?: string;
  message?: string;
}

export type LogInput = Omit<LogEntry, 'id' | 'timestamp'>;

type Subscriber = (entry: LogEntry) => void;

const buffer: LogEntry[] = [];
const subscribers = new Set<Subscriber>();
let nextId = 1;

export function pushLog(input: LogInput): void {
  const entry: LogEntry = { ...input, id: nextId++, timestamp: new Date().toISOString() };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.shift();
  }
  for (const cb of subscribers) {
    try {
      cb(entry);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export function getEntries(sinceId?: number): LogEntry[] {
  if (sinceId === undefined) return [...buffer];
  return buffer.filter((e) => e.id > sinceId);
}

export function subscribe(cb: Subscriber): void {
  subscribers.add(cb);
}

export function unsubscribe(cb: Subscriber): void {
  subscribers.delete(cb);
}

/** Reset buffer state. Exported for tests only. */
export function _resetForTest(): void {
  buffer.length = 0;
  subscribers.clear();
  nextId = 1;
}

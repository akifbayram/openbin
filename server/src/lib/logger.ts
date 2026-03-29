const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

const threshold = LEVELS[((process.env.LOG_LEVEL || 'info') as Level)] ?? LEVELS.info;

function log(level: Level, namespace: string, msg: string, extra?: unknown): void {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  const tag = `${ts} [${level.toUpperCase()}] [${namespace}]`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (extra !== undefined) {
    fn(tag, msg, extra);
  } else {
    fn(tag, msg);
  }
}

export interface Logger {
  debug(msg: string, extra?: unknown): void;
  info(msg: string, extra?: unknown): void;
  warn(msg: string, extra?: unknown): void;
  error(msg: string, extra?: unknown): void;
}

export function createLogger(namespace: string): Logger {
  return {
    debug: (msg, extra?) => log('debug', namespace, msg, extra),
    info: (msg, extra?) => log('info', namespace, msg, extra),
    warn: (msg, extra?) => log('warn', namespace, msg, extra),
    error: (msg, extra?) => log('error', namespace, msg, extra),
  };
}

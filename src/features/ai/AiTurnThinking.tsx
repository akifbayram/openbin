interface AiTurnThinkingProps {
  phase: 'parsing' | 'querying' | 'executing';
}

const LABELS: Record<AiTurnThinkingProps['phase'], string> = {
  parsing: 'Thinking',
  querying: 'Searching',
  executing: 'Applying',
};

export function AiTurnThinking({ phase }: AiTurnThinkingProps) {
  return (
    <output
      className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] px-1"
      aria-busy="true"
      aria-label="AI is thinking"
    >
      <span className="inline-flex gap-1 items-center">
        <span
          className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] ai-thinking-pulse"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] ai-thinking-pulse"
          style={{ animationDelay: '200ms' }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] ai-thinking-pulse"
          style={{ animationDelay: '400ms' }}
        />
      </span>
      <span>{LABELS[phase]}…</span>
    </output>
  );
}

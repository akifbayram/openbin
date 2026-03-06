import { useMemo } from 'react';

interface HighlightProps {
  text: string;
  query: string;
}

export function Highlight({ text, query }: HighlightProps) {
  const trimmed = query.trim();

  const parts = useMemo(() => {
    if (!trimmed) return null;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.split(new RegExp(`(${escaped})`, 'gi'));
  }, [text, trimmed]);

  if (!parts) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: text fragments from split() have no stable identity
          <mark key={i} className="bg-[var(--accent)]/20 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

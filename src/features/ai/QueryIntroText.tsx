interface QueryIntroTextProps {
  text: string;
}

export function QueryIntroText({ text }: QueryIntroTextProps) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return (
    <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
      {trimmed}
    </p>
  );
}

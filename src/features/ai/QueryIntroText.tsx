interface QueryIntroTextProps {
  text: string;
}

export function QueryIntroText({ text }: QueryIntroTextProps) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return (
    <p className="text-[14px] text-[var(--text-primary)] leading-relaxed">
      {trimmed}
    </p>
  );
}

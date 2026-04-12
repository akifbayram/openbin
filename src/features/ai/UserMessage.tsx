interface UserMessageProps {
  text: string;
}

export function UserMessage({ text }: UserMessageProps) {
  return (
    <div className="ml-auto max-w-[85%] bg-[var(--accent)] text-[var(--text-on-accent)] rounded-[var(--radius-md)] px-3 py-2 text-[14px] leading-[1.4] whitespace-pre-wrap break-words">
      {text}
    </div>
  );
}

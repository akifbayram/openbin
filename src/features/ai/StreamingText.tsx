interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
  className?: string;
}

export function StreamingText({ text, isStreaming, className }: StreamingTextProps) {
  return (
    <p className={className} style={{ whiteSpace: 'pre-wrap' }}>
      {text}
      {isStreaming && (
        <span
          data-streaming-cursor=""
          className="inline-block ml-0.5 animate-[cursor-blink_530ms_step-end_infinite]"
        >
          {'\u258C'}
        </span>
      )}
    </p>
  );
}

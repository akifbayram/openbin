import { useNavigate } from 'react-router-dom';

interface ChatBinCardProps {
  bin: {
    id: string;
    name: string;
    area_name?: string;
    items?: string[];
    tags?: string[];
    icon?: string;
    color?: string;
  };
  onClick?: () => void;
}

export function ChatBinCard({ bin, onClick }: ChatBinCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/bin/${bin.id}`);
    }
  };

  const visibleItems = bin.items?.slice(0, 5) ?? [];
  const remainingItems = (bin.items?.length ?? 0) - visibleItems.length;
  const visibleTags = bin.tags?.slice(0, 4) ?? [];

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 transition-colors hover:bg-[var(--bg-tertiary)]"
    >
      <div className="flex items-center gap-2">
        {bin.icon && <span className="text-[16px]">{bin.icon}</span>}
        <span
          className="text-[14px] font-semibold text-[var(--text-primary)] truncate"
          style={bin.color ? { color: bin.color } : undefined}
        >
          {bin.name}
        </span>
      </div>

      {bin.area_name && (
        <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">{bin.area_name}</p>
      )}

      {visibleItems.length > 0 && (
        <p className="mt-1.5 text-[12px] text-[var(--text-secondary)] truncate">
          {visibleItems.join(', ')}
          {remainingItems > 0 && ` +${remainingItems} more`}
        </p>
      )}

      {visibleTags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-[var(--radius-full)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

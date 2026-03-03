import { Check, X } from 'lucide-react';
import type { ActionPreview } from './useChat';

interface ChatActionPreviewProps {
  actions: ActionPreview[];
  status: 'pending' | 'accepted' | 'rejected';
  onAccept: () => void;
  onReject: () => void;
}

export function ChatActionPreview({ actions, status, onAccept, onReject }: ChatActionPreviewProps) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
      <p className="mb-2 text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
        Proposed Actions
      </p>

      <ul className="space-y-1.5">
        {actions.map((action) => (
          <li key={action.id} className="flex items-start gap-2 text-[13px]">
            {status === 'accepted' && (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
            )}
            {status === 'rejected' && (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
            )}
            {status === 'pending' && (
              <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--border-primary)]" />
            )}
            <span className="text-[var(--text-primary)]">{action.description}</span>
          </li>
        ))}
      </ul>

      {status === 'pending' && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-semibold text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Check className="h-3.5 w-3.5" />
            Accept
          </button>
          <button
            type="button"
            onClick={onReject}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--bg-input)] px-3 py-1.5 text-[13px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-active)]"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
        </div>
      )}

      {status === 'accepted' && (
        <p className="mt-2 text-[12px] text-green-500">Actions accepted</p>
      )}
      {status === 'rejected' && (
        <p className="mt-2 text-[12px] text-red-500">Actions rejected</p>
      )}
    </div>
  );
}

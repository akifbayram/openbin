import { AlertCircle, Check, Package, X } from 'lucide-react';
import { ChatActionPreview } from './ChatActionPreview';
import { ChatBinCard } from './ChatBinCard';
import type { ChatMessageContent, ToolResult } from './useChat';

interface ChatMessageProps {
  message: ChatMessageContent;
  onConfirmActions?: (confirmationId: string, accepted: boolean) => void;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Tool result renderers
// ---------------------------------------------------------------------------

interface BinResult {
  id: string;
  name: string;
  area_name?: string;
  items?: string | Array<{ id: string; name: string }>;
  tags?: string | string[];
  icon?: string;
  color?: string;
}

function parseBinItems(items: string | Array<{ id: string; name: string }> | undefined): string[] {
  if (!items) return [];
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items) as Array<{ name: string }>;
      return parsed.map((i) => i.name);
    } catch {
      return [];
    }
  }
  return items.map((i) => i.name);
}

function parseTags(tags: string | string[] | undefined): string[] {
  if (!tags) return [];
  if (typeof tags === 'string') {
    try {
      return JSON.parse(tags) as string[];
    } catch {
      return [];
    }
  }
  return tags;
}

function toBinCardProps(bin: BinResult): {
  id: string;
  name: string;
  area_name?: string;
  items?: string[];
  tags?: string[];
  icon?: string;
  color?: string;
} {
  return {
    id: bin.id,
    name: bin.name,
    area_name: bin.area_name,
    items: parseBinItems(bin.items),
    tags: parseTags(bin.tags),
    icon: bin.icon,
    color: bin.color,
  };
}

interface ItemResult {
  item_name: string;
  bin_id: string;
  bin_name: string;
  area_name?: string;
}

function ToolResultRenderer({ result, onClose }: { result: ToolResult; onClose?: () => void }) {
  let parsed: unknown;
  try {
    parsed = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
  } catch {
    parsed = result.result;
  }

  if (result.name === 'search_bins') {
    const data = parsed as { bins?: BinResult[]; count?: number } | null;
    const bins = data?.bins;
    if (!bins || bins.length === 0) return null;

    return (
      <div className="mt-2 space-y-2">
        {bins.map((bin) => (
          <ChatBinCard
            key={bin.id}
            bin={toBinCardProps(bin)}
            onClick={onClose ? () => { onClose(); } : undefined}
          />
        ))}
      </div>
    );
  }

  if (result.name === 'get_bin') {
    const bin = parsed as BinResult | null;
    if (!bin || (bin as { error?: string }).error) return null;

    return (
      <div className="mt-2">
        <ChatBinCard
          bin={toBinCardProps(bin)}
          onClick={onClose ? () => { onClose(); } : undefined}
        />
      </div>
    );
  }

  if (result.name === 'search_items') {
    const data = parsed as { items?: ItemResult[]; count?: number } | null;
    const items = data?.items;
    if (!items || items.length === 0) return null;

    return (
      <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={`${item.bin_id}-${item.item_name}`} className="flex items-center gap-2 text-[13px]">
              <Package className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
              <span className="text-[var(--text-primary)]">{item.item_name}</span>
              <span className="text-[var(--text-tertiary)]">in</span>
              <span className="font-medium text-[var(--text-secondary)]">{item.bin_name}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // For other tools, don't render anything special
  return null;
}

// ---------------------------------------------------------------------------
// Executed actions renderer
// ---------------------------------------------------------------------------

function ExecutedActions({ actions }: { actions: Array<{ toolCallId: string; success: boolean; details: string }> }) {
  return (
    <div className="mt-2 space-y-1">
      {actions.map((action) => (
        <div key={action.toolCallId} className="flex items-start gap-2 text-[13px]">
          {action.success ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
          ) : (
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
          )}
          <span className={action.success ? 'text-[var(--text-secondary)]' : 'text-red-500'}>
            {action.details}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ChatMessage({ message, onConfirmActions, onClose }: ChatMessageProps) {
  const { role, text, toolResults, actionPreview, executedActions, isStreaming, error } = message;

  // System messages
  if (role === 'system') {
    return (
      <div className="flex justify-center py-1">
        <p className="text-[12px] text-[var(--text-tertiary)]">{text}</p>
      </div>
    );
  }

  // User messages
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-2">
          <p className="whitespace-pre-wrap text-[14px] text-[var(--text-on-accent)]">{text}</p>
        </div>
      </div>
    );
  }

  // Assistant messages
  const showCursor = isStreaming && !text && !error;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-1">
        {(text || showCursor) && (
          <div className="rounded-[var(--radius-md)] bg-[var(--bg-secondary)] px-3 py-2">
            {text && (
              <p className="whitespace-pre-wrap text-[14px] text-[var(--text-primary)]">{text}</p>
            )}
            {showCursor && (
              <span className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-[var(--text-tertiary)]" />
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] px-3 py-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-[14px] text-red-500">{error}</p>
          </div>
        )}

        {toolResults?.map((tr) => (
          <ToolResultRenderer key={tr.toolCallId} result={tr} onClose={onClose} />
        ))}

        {actionPreview && onConfirmActions && (
          <ChatActionPreview
            actions={actionPreview.actions}
            status={actionPreview.status}
            onAccept={() => onConfirmActions(actionPreview.confirmationId, true)}
            onReject={() => onConfirmActions(actionPreview.confirmationId, false)}
          />
        )}

        {executedActions && executedActions.length > 0 && (
          <ExecutedActions actions={executedActions} />
        )}
      </div>
    </div>
  );
}

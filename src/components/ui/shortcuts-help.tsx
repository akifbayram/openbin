import { formatKeys, groupedShortcuts } from '@/lib/shortcuts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-input)] font-mono text-[12px] text-[var(--text-secondary)] leading-none">
      {children}
    </kbd>
  );
}

export function ShortcutsHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const groups = groupedShortcuts();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.category}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                {group.category}
              </h3>
              <div className="space-y-1.5">
                {group.items.map((s) => {
                  const keys = formatKeys(s.keys);
                  return (
                    <div key={s.id} className="flex items-center justify-between py-1">
                      <span className="text-[14px] text-[var(--text-primary)]">{s.label}</span>
                      <div className="flex items-center gap-1">
                        {keys.map((k, i) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: static list of keyboard shortcut keys
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && <span className="text-[11px] text-[var(--text-tertiary)]">then</span>}
                            <KeyBadge>{k}</KeyBadge>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Drawer } from '@chakra-ui/react';
import { DRAWER_PLACEMENT } from '@/components/ui/provider';
import { formatKeys, groupedShortcuts } from '@/lib/shortcuts';

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-[var(--radius-sm)] bg-gray-500/12 dark:bg-gray-500/24 font-mono text-[12px] text-gray-600 dark:text-gray-300 leading-none">
      {children}
    </kbd>
  );
}

export function ShortcutsHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const groups = groupedShortcuts();

  return (
    <Drawer.Root placement={DRAWER_PLACEMENT} open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Title>Keyboard Shortcuts</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body>
            <div className="space-y-5">
              {groups.map((group) => (
                <div key={group.category}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {group.category}
                  </h3>
                  <div className="space-y-1.5">
                    {group.items.map((s) => {
                      const keys = formatKeys(s.keys);
                      return (
                        <div key={s.id} className="flex items-center justify-between py-1">
                          <span className="text-[14px]">{s.label}</span>
                          <div className="flex items-center gap-1">
                            {keys.map((k, i) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: static list of keyboard shortcut keys
                              <span key={i} className="flex items-center gap-1">
                                {i > 0 && <span className="text-[11px] text-gray-500 dark:text-gray-400">then</span>}
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
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}

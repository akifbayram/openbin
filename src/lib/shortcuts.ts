export interface ShortcutDef {
  id: string;
  label: string;
  category: 'navigation' | 'action' | 'general';
  keys: string;
  icon?: string;
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: 'go-home', label: 'Go to Home', category: 'navigation', keys: 'g h' },
  { id: 'go-bins', label: 'Go to Bins', category: 'navigation', keys: 'g b' },
  { id: 'go-scan', label: 'Scan QR Code', category: 'action', keys: 'g s' },
  { id: 'go-print', label: 'Go to Print', category: 'navigation', keys: 'g p' },
  { id: 'go-locations', label: 'Go to Locations', category: 'navigation', keys: 'g l' },
  { id: 'go-items', label: 'Go to Items', category: 'navigation', keys: 'g i' },
  { id: 'go-tags', label: 'Go to Tags', category: 'navigation', keys: 'g t' },
  { id: 'go-settings', label: 'Go to Settings', category: 'navigation', keys: 'g e' },
  { id: 'new-bin', label: 'New Bin', category: 'action', keys: 'n' },
  { id: 'focus-search', label: 'Focus Search', category: 'action', keys: '/' },
  { id: 'command-palette', label: 'Command Palette', category: 'general', keys: 'mod+k' },
  { id: 'toggle-sidebar', label: 'Toggle Sidebar', category: 'general', keys: '[' },
  { id: 'shortcuts-help', label: 'Keyboard Shortcuts', category: 'general', keys: '?' },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

export function formatKeys(keys: string): string[] {
  return keys.split(' ').map((part) => {
    if (part === 'mod+k') return isMac ? '\u2318K' : 'Ctrl+K';
    return part.toUpperCase();
  });
}

const CATEGORY_ORDER: ShortcutDef['category'][] = ['navigation', 'action', 'general'];
const CATEGORY_LABELS: Record<ShortcutDef['category'], string> = {
  navigation: 'Navigation',
  action: 'Actions',
  general: 'General',
};

export function groupedShortcuts(): { category: string; items: ShortcutDef[] }[] {
  return CATEGORY_ORDER.map((cat) => ({
    category: CATEGORY_LABELS[cat],
    items: SHORTCUTS.filter((s) => s.category === cat),
  }));
}

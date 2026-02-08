import { Package, ScanLine, Printer, Settings } from 'lucide-react';

export const navItems = [
  { path: '/', label: 'Bins', icon: Package },
  { path: '/scan', label: 'Scan', icon: ScanLine },
  { path: '/print', label: 'Print', icon: Printer },
  { path: '/settings', label: 'Settings', icon: Settings },
] as const;

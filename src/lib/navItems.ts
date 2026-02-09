import { Package, ScanLine, Printer, Settings, Home } from 'lucide-react';

export const navItems = [
  { path: '/', label: 'Bins', icon: Package },
  { path: '/scan', label: 'Scan', icon: ScanLine },
  { path: '/homes', label: 'Homes', icon: Home },
  { path: '/print', label: 'Print', icon: Printer },
  { path: '/settings', label: 'Settings', icon: Settings },
] as const;

import { LayoutDashboard, ScanLine, Printer, Settings, MapPin, Package } from 'lucide-react';

export const navItems = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/bins', label: 'Bins', icon: Package },
  { path: '/areas', label: 'Areas', icon: MapPin },
  { path: '/print', label: 'Print', icon: Printer },
  { path: '/scan', label: 'Scan', icon: ScanLine },
] as const;

export const settingsNavItem = { path: '/settings', label: 'Settings', icon: Settings } as const;

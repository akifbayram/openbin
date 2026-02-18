import { LayoutDashboard, ScanLine, Printer, Settings, MapPin, Package } from 'lucide-react';
import type { Terminology } from '@/lib/terminology';

export type TermKey = keyof Terminology;

export interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  termKey?: TermKey;
}

export const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/bins', label: 'Bins', icon: Package, termKey: 'Bins' },
  { path: '/areas', label: 'Locations', icon: MapPin, termKey: 'Locations' },
  { path: '/print', label: 'Print', icon: Printer },
  { path: '/scan', label: 'Scan', icon: ScanLine },
];

export const settingsNavItem: NavItem = { path: '/settings', label: 'Settings', icon: Settings };

import { LayoutDashboard, MapPin, Package, PackageSearch, Printer, ScanLine, Sparkles } from 'lucide-react';
import type { Terminology } from '@/lib/terminology';

export type TermKey = keyof Terminology;

export interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  termKey?: TermKey;
  proOnly?: boolean;
}

export const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/bins', label: 'Bins', icon: Package, termKey: 'Bins' },
  { path: '/locations', label: 'Locations', icon: MapPin, termKey: 'Locations' },
  { path: '/checkouts', label: 'Checked Out', icon: PackageSearch },
  { path: '/print', label: 'Print', icon: Printer },
  { path: '/reorganize', label: 'Reorganize', icon: Sparkles, proOnly: true },
  { path: '/scan', label: 'Scan', icon: ScanLine },
];

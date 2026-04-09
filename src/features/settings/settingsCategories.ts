import type { LucideIcon } from 'lucide-react';
import {
  CreditCard,
  Database,
  Info,
  Paintbrush,
  Settings,
  Shield,
  Sparkles,
  User,
} from 'lucide-react';

export interface SettingsCategory {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  path: string;
  external?: boolean;
  gate?: 'admin' | 'ee' | 'siteAdmin';
  adminSection?: boolean;
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'account',
    label: 'Account',
    description: 'Profile, security, API keys',
    icon: User,
    path: 'account',
  },
  {
    id: 'subscription',
    label: 'Subscription',
    description: 'Plan and billing',
    icon: CreditCard,
    path: 'subscription',
    gate: 'ee',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    description: 'Theme, shortcuts, dashboard',
    icon: Settings,
    path: 'preferences',
  },
  {
    id: 'personalization',
    label: 'Personalization',
    description: 'App name and terminology',
    icon: Paintbrush,
    path: 'personalization',
    gate: 'admin',
  },
  {
    id: 'ai',
    label: 'AI',
    description: 'Provider, models, prompts',
    icon: Sparkles,
    path: 'ai',
    gate: 'admin',
  },
  {
    id: 'data',
    label: 'Data',
    description: 'Export, import, activity',
    icon: Database,
    path: 'data',
    gate: 'admin',
  },
  {
    id: 'about',
    label: 'About',
    description: 'Version and info',
    icon: Info,
    path: 'about',
  },
  {
    id: 'admin',
    label: 'Admin Dashboard',
    description: 'Manage users and system',
    icon: Shield,
    path: '/admin/users',
    external: true,
    gate: 'siteAdmin',
    adminSection: true,
  },
];

export interface FilterOptions {
  isAdmin: boolean;
  isEE: boolean;
  isSiteAdmin: boolean;
}

export function filterCategories(options: FilterOptions): SettingsCategory[] {
  const { isAdmin, isEE, isSiteAdmin } = options;
  return SETTINGS_CATEGORIES.filter((cat) => {
    if (!cat.gate) return true;
    if (cat.gate === 'admin') return isAdmin;
    if (cat.gate === 'ee') return isEE;
    if (cat.gate === 'siteAdmin') return isSiteAdmin;
    return false;
  });
}

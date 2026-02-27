import type { ReactNode } from 'react';
import { createElement } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Image,
  ArrowRightLeft,
  LogIn,
  LogOut,
  UserMinus,
  MapPin,
  Users,
  Package,
} from 'lucide-react';
import type { ActivityLogEntry } from '@/types';
import type { Terminology } from '@/lib/terminology';

export type EntityTypeFilter = '' | 'bin' | 'area' | 'member' | 'location';

export const ENTITY_TYPE_FILTERS: { value: EntityTypeFilter; label: string; tKey?: keyof Terminology }[] = [
  { value: '', label: 'All' },
  { value: 'bin', label: 'Bins', tKey: 'Bins' },
  { value: 'area', label: 'Areas', tKey: 'Areas' },
  { value: 'member', label: 'Members' },
  { value: 'location', label: 'Location', tKey: 'Location' },
];

export function getActionIcon(entry: ActivityLogEntry): ReactNode {
  const cls = 'h-3 w-3';
  const { action, entity_type } = entry;
  if (action === 'create') return createElement(Plus, { className: cls });
  if (action === 'update') return createElement(Pencil, { className: cls });
  if (action === 'delete' || action === 'permanent_delete') return createElement(Trash2, { className: cls });
  if (action === 'restore') return createElement(RotateCcw, { className: cls });
  if (action === 'add_photo') return createElement(Image, { className: cls });
  if (action === 'delete_photo') return createElement(Image, { className: cls });
  if (action === 'move_in' || action === 'move_out') return createElement(ArrowRightLeft, { className: cls });
  if (action === 'join') return createElement(LogIn, { className: cls });
  if (action === 'leave') return createElement(LogOut, { className: cls });
  if (action === 'remove_member') return createElement(UserMinus, { className: cls });
  if (entity_type === 'area') return createElement(MapPin, { className: cls });
  if (entity_type === 'member') return createElement(Users, { className: cls });
  return createElement(Package, { className: cls });
}

export function getActionColor(action: string): string {
  if (action === 'create') return 'text-green-500';
  if (action === 'delete' || action === 'permanent_delete') return 'text-[var(--destructive)]';
  if (action === 'restore') return 'text-[var(--accent)]';
  if (action === 'update') return 'text-amber-500';
  if (action === 'move_in' || action === 'move_out') return 'text-blue-500';
  return 'text-[var(--text-tertiary)]';
}

export function getActionLabel(entry: ActivityLogEntry, t: Terminology): string {
  const name = entry.entity_name ? `"${entry.entity_name}"` : '';
  const { action, entity_type } = entry;

  if (entity_type === 'bin') {
    if (action === 'create') return `created ${t.bin} ${name}`;
    if (action === 'update') {
      const c = entry.changes;
      if (c) {
        const keys = Object.keys(c);
        const itemOnly = keys.every(
          (k) => k === 'items_added' || k === 'items_removed' || k === 'items_renamed' || k === 'items',
        );
        if (itemOnly) {
          const added = c.items_added ? (c.items_added.new as string[]) : [];
          const removed = c.items_removed ? (c.items_removed.old as string[]) : [];
          const renamed = c.items_renamed ? c.items_renamed : null;
          let legacyAdded: string[] = [];
          let legacyRemoved: string[] = [];
          if (c.items && Array.isArray(c.items.old) && Array.isArray(c.items.new)) {
            legacyAdded = (c.items.new as string[]).filter((i) => !(c.items.old as string[]).includes(i));
            legacyRemoved = (c.items.old as string[]).filter((i) => !(c.items.new as string[]).includes(i));
          }
          const allAdded = [...added, ...legacyAdded];
          const allRemoved = [...removed, ...legacyRemoved];
          if (renamed && !allAdded.length && !allRemoved.length) {
            return `renamed ${String(renamed.old ?? '')} to ${String(renamed.new ?? '')} in ${t.bin} ${name}`;
          }
          if (allAdded.length && !allRemoved.length) {
            return `added ${allAdded.join(', ')} to ${t.bin} ${name}`;
          }
          if (allRemoved.length && !allAdded.length) {
            return `removed ${allRemoved.join(', ')} from ${t.bin} ${name}`;
          }
          if (allAdded.length && allRemoved.length) {
            return `added ${allAdded.join(', ')} and removed ${allRemoved.join(', ')} in ${t.bin} ${name}`;
          }
          if (c.items && !allAdded.length && !allRemoved.length) {
            return `reordered items in ${t.bin} ${name}`;
          }
        }
      }
      return `updated ${t.bin} ${name}`;
    }
    if (action === 'delete') return `deleted ${t.bin} ${name}`;
    if (action === 'restore') return `restored ${t.bin} ${name}`;
    if (action === 'permanent_delete') return `permanently deleted ${t.bin} ${name}`;
    if (action === 'move_in' || action === 'move_out') {
      const from = entry.changes?.location?.old;
      const to = entry.changes?.location?.new;
      return `moved ${t.bin} ${name} from ${from ?? '?'} to ${to ?? '?'}`;
    }
    if (action === 'add_photo') return `added photo to ${t.bin} ${name}`;
    if (action === 'delete_photo') return `removed photo from ${t.bin} ${name}`;
  }
  if (entity_type === 'area') {
    if (action === 'create') return `created ${t.area} ${name}`;
    if (action === 'update') return `renamed ${t.area} to ${name}`;
    if (action === 'delete') return `deleted ${t.area} ${name}`;
  }
  if (entity_type === 'member') {
    if (action === 'join') return `joined the ${t.location}`;
    if (action === 'leave') return `left the ${t.location}`;
    if (action === 'remove_member') return `removed ${name}`;
  }
  if (entity_type === 'location') {
    if (action === 'update') return `updated ${t.location} ${name}`;
  }

  return `${action} ${entity_type} ${name}`;
}

const ITEM_FIELDS = new Set(['items_added', 'items_removed', 'items_renamed', 'items']);
const SKIP_FIELDS = new Set(['location', 'area_id']);

export function renderChangeDiff(entry: ActivityLogEntry): { field: string; old: string; new: string }[] | null {
  if (!entry.changes) return null;
  const fields = Object.entries(entry.changes).filter(([f]) => !ITEM_FIELDS.has(f) && !SKIP_FIELDS.has(f));
  if (fields.length === 0) return null;

  return fields.map(([field, diff]) => {
    const label =
      field === 'area' ? 'area' : field === 'name' ? 'name' : field === 'card_style' ? 'style' : field;
    const formatVal = (val: unknown) => {
      if (field === 'card_style') {
        try {
          const parsed = typeof val === 'string' ? JSON.parse(val) : val;
          return (parsed?.variant as string) || 'glass';
        } catch {
          return String(val || 'glass');
        }
      }
      return String(val ?? 'none');
    };
    return { field: label, old: formatVal(diff.old), new: formatVal(diff.new) };
  });
}

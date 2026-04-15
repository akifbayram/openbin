import {
  ArrowRightLeft,
  Image,
  LogIn,
  LogOut,
  MapPin,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { Terminology } from '@/lib/terminology';
import type { ActivityLogEntry } from '@/types';

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
  if (action === 'change_role') return createElement(Users, { className: cls });
  if (action === 'regenerate_invite') return createElement(RotateCcw, { className: cls });
  if (entity_type === 'area') return createElement(MapPin, { className: cls });
  if (entity_type === 'member') return createElement(Users, { className: cls });
  return createElement(Package, { className: cls });
}

export function getActionColor(action: string): string {
  if (action === 'create') return 'text-[var(--color-success)]';
  if (action === 'delete' || action === 'permanent_delete') return 'text-[var(--destructive)]';
  if (action === 'restore') return 'text-[var(--accent)]';
  if (action === 'update') return 'text-[var(--color-warning)]';
  if (action === 'move_in' || action === 'move_out') return 'text-[var(--color-info)]';
  return 'text-[var(--text-tertiary)]';
}

const ACTION_BADGE_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  permanent_delete: 'Deleted',
  restore: 'Restored',
  add_photo: 'Photo',
  delete_photo: 'Photo',
  move_in: 'Moved',
  move_out: 'Moved',
  join: 'Joined',
  leave: 'Left',
  remove_member: 'Removed',
  change_role: 'Role',
  regenerate_invite: 'Invite',
};

export function getActionBadgeLabel(action: string): string {
  if (ACTION_BADGE_LABELS[action]) return ACTION_BADGE_LABELS[action];
  return action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function getActionLabel(entry: ActivityLogEntry, t: Terminology): string {
  const name = entry.entity_name ? `"${entry.entity_name}"` : '';
  const { action, entity_type } = entry;

  if (entity_type === 'bin') {
    if (action === 'create') return `created ${t.bin} ${name}`;
    if (action === 'update') return `updated ${t.bin} ${name}`;
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
    if (action === 'change_role') return `changed role for ${name}`;
  }
  if (entity_type === 'location') {
    if (action === 'create') return `created ${t.location} ${name}`;
    if (action === 'update') return `updated ${t.location} ${name}`;
    if (action === 'regenerate_invite') return `regenerated invite code`;
  }

  return `${action} ${entity_type} ${name}`;
}

const ITEM_FIELDS = new Set(['items_added', 'items_removed', 'items_renamed', 'items']);
const SKIP_FIELDS = new Set(['location', 'area_id']);

export function renderChangeDiff(entry: ActivityLogEntry): { field: string; old: string; new: string }[] | null {
  if (!entry.changes) return null;

  const fieldDiffs = Object.entries(entry.changes)
    .filter(([f]) => !ITEM_FIELDS.has(f) && !SKIP_FIELDS.has(f))
    .map(([field, diff]) => {
      const label =
        field === 'area' ? 'area' : field === 'name' ? 'name' : field === 'card_style' ? 'style' : field;
      const formatVal = (val: unknown) => {
        if (field === 'card_style') {
          try {
            const parsed = typeof val === 'string' ? JSON.parse(val) : val;
            return (parsed?.variant as string) || 'default';
          } catch {
            return String(val || 'default');
          }
        }
        return String(val ?? 'none');
      };
      return { field: label, old: formatVal(diff.old), new: formatVal(diff.new) };
    });

  const itemDiffs: { field: string; old: string; new: string }[] = [];
  const c = entry.changes;

  if (c.items_added) {
    const added = c.items_added.new as string[] | null;
    if (added && added.length > 0) {
      itemDiffs.push({ field: '+ items', old: '', new: added.join(', ') });
    }
  }
  if (c.items_removed) {
    const removed = c.items_removed.old as string[] | null;
    if (removed && removed.length > 0) {
      itemDiffs.push({ field: '− items', old: removed.join(', '), new: '' });
    }
  }
  if (c.items_renamed) {
    const renamed = c.items_renamed;
    if (Array.isArray(renamed.new)) {
      for (const pair of renamed.new as Array<{ old: string; new: string }>) {
        itemDiffs.push({ field: 'renamed', old: String(pair.old), new: String(pair.new) });
      }
    } else {
      itemDiffs.push({
        field: 'renamed',
        old: String(renamed.old ?? ''),
        new: String(renamed.new ?? ''),
      });
    }
  }

  const allDiffs = [...fieldDiffs, ...itemDiffs];
  return allDiffs.length > 0 ? allDiffs : null;
}

export function getEntityDescription(entry: ActivityLogEntry, t: Terminology): string {
  const name = entry.entity_name ? `"${entry.entity_name}"` : '';
  const { action, entity_type } = entry;

  if (entity_type === 'bin') {
    if (action === 'move_in' || action === 'move_out') {
      const from = entry.changes?.location?.old;
      const to = entry.changes?.location?.new;
      return `${t.bin} ${name} from ${from ?? '?'} to ${to ?? '?'}`;
    }
    if (action === 'add_photo' || action === 'delete_photo') {
      return `photo on ${t.bin} ${name}`;
    }
    return `${t.bin} ${name}`;
  }
  if (entity_type === 'area') return `${t.area} ${name}`;
  if (entity_type === 'member') {
    if (action === 'join') return `the ${t.location}`;
    if (action === 'leave') return `the ${t.location}`;
    if (action === 'remove_member') return name;
    if (action === 'change_role') return `role for ${name}`;
    return name;
  }
  if (entity_type === 'location') {
    if (action === 'regenerate_invite') return 'invite code';
    return `${t.location} ${name}`;
  }
  return `${entity_type} ${name}`;
}

type ScalarField = 'name' | 'notes' | 'tags' | 'icon' | 'color' | 'visibility' | 'card_style';

const SCALAR_LABEL_MAP: Record<ScalarField, string> = {
  name: 'name',
  notes: 'notes',
  tags: 'tags',
  icon: 'icon',
  color: 'color',
  visibility: 'visibility',
  card_style: 'style',
};

export function getChangedFieldLabels(entry: ActivityLogEntry, t: Terminology): string[] {
  if (entry.action !== 'update' || entry.entity_type !== 'bin' || !entry.changes) {
    return [];
  }

  const labels: string[] = [];

  for (const [field, diff] of Object.entries(entry.changes)) {
    if (field === 'location' || field === 'area_id') continue;

    if (field === 'area') {
      labels.push(t.area);
      continue;
    }

    if (field === 'items_added') {
      const n = Array.isArray(diff.new) ? diff.new.length : 0;
      if (n > 0) labels.push(`+${n} item${n === 1 ? '' : 's'}`);
      continue;
    }

    if (field === 'items_removed') {
      const n = Array.isArray(diff.old) ? (diff.old as unknown[]).length : 0;
      if (n > 0) labels.push(`\u2212${n} item${n === 1 ? '' : 's'}`);
      continue;
    }

    if (field === 'items_renamed') {
      if (Array.isArray(diff.new)) {
        const n = diff.new.length;
        if (n > 0) labels.push(n === 1 ? 'renamed item' : `renamed ${n} items`);
      } else {
        labels.push('renamed item');
      }
      continue;
    }

    if (field === 'items_quantity') {
      labels.push('quantity');
      continue;
    }

    if (field === 'items') continue; // legacy reorder — no chip

    const scalar = SCALAR_LABEL_MAP[field as ScalarField];
    if (scalar) labels.push(scalar);
  }

  return labels;
}

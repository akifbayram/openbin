import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type SortDirection, SortHeader } from '@/components/ui/sort-header';
import { type AdminUser, capitalize, statusVariant } from './useAdminUsers';

type SortField = 'username' | 'email' | 'plan' | 'status' | 'bins' | 'locations' | 'storage' | 'created';

interface AdminUsersTableProps {
  users: AdminUser[];
  currentUserId: string;
  sortColumn: SortField;
  sortDirection: SortDirection;
  onSort: (column: SortField, direction: SortDirection) => void;
  onDelete: (user: AdminUser) => void;
  onClickUser: (id: string) => void;
}

function Header({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
  className,
  defaultDirection,
  desktopOnly,
}: {
  label: string;
  column: SortField;
  sortColumn: SortField;
  sortDirection: SortDirection;
  onSort: (column: SortField, direction: SortDirection) => void;
  className?: string;
  defaultDirection?: SortDirection;
  desktopOnly?: boolean;
}) {
  return (
    <th className={desktopOnly ? `hidden lg:table-cell ${className}` : className}>
      <SortHeader
        label={label}
        column={column}
        currentColumn={sortColumn}
        currentDirection={sortDirection}
        onSort={onSort}
        defaultDirection={defaultDirection}
      />
    </th>
  );
}

export function AdminUsersTable({
  users,
  currentUserId,
  sortColumn,
  sortDirection,
  onSort,
  onDelete,
  onClickUser,
}: AdminUsersTableProps) {
  const thBase = 'px-3 py-2.5 text-left font-normal whitespace-nowrap';
  const thRight = 'px-3 py-2.5 text-right font-normal whitespace-nowrap';
  const tdBase = 'px-3 py-2.5 text-[14px] text-[var(--text-secondary)]';
  const tdRight = 'px-3 py-2.5 text-[14px] text-[var(--text-secondary)] text-right tabular-nums';

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b-2 border-[var(--border-flat)]">
            <Header label="User" column="username" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className={thBase} />
            <Header label="Email" column="email" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className={thBase} desktopOnly />
            <th className={thBase}>
              <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Role</span>
            </th>
            <Header label="Plan" column="plan" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className={thBase} />
            <Header label="Status" column="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className={thBase} />
            <Header label="Bins" column="bins" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className={thRight} defaultDirection="desc" desktopOnly />
            <Header label="Locations" column="locations" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className={thRight} defaultDirection="desc" desktopOnly />
            <Header label="Storage" column="storage" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className={thRight} defaultDirection="desc" desktopOnly />
            <Header label="Created" column="created" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className={thBase} />
            <th className={thBase} />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <tr
                key={u.id}
                onClick={() => onClickUser(u.id)}
                className="border-b border-[var(--border-subtle)] cursor-pointer transition-colors [@media(hover:hover)]:hover:bg-[var(--bg-hover)]"
                style={u.deletedAt ? { opacity: 0.5 } : undefined}
              >
                <td className={tdBase}>
                  <div className="font-medium text-[var(--text-primary)]">{u.displayName || u.username}</div>
                  <div className="text-[12px] text-[var(--text-tertiary)]">@{u.username}</div>
                </td>
                <td className={`hidden lg:table-cell ${tdBase}`}>{u.email || '—'}</td>
                <td className={tdBase}>
                  {u.isAdmin ? <Badge variant="default" className="text-[11px]">Admin</Badge> : <span className="text-[var(--text-muted)]">—</span>}
                </td>
                <td className={tdBase}>
                  <Badge variant="secondary" className="text-[11px]">{capitalize(u.plan)}</Badge>
                </td>
                <td className={tdBase}>
                  <span className="flex items-center gap-1.5">
                    {u.deletedAt && <Badge variant="destructive" className="text-[11px]">Deleted</Badge>}
                    <Badge variant={statusVariant(u.status)} className="text-[11px]">{capitalize(u.status)}</Badge>
                  </span>
                </td>
                <td className={`hidden lg:table-cell ${tdRight}`}>{u.deletedAt ? '—' : u.binCount}</td>
                <td className={`hidden lg:table-cell ${tdRight}`}>{u.deletedAt ? '—' : u.locationCount}</td>
                <td className={`hidden lg:table-cell ${tdRight}`}>{u.deletedAt ? '—' : `${u.photoStorageMb} MB`}</td>
                <td className={tdBase}>
                  <span className="text-[12px] text-[var(--text-muted)] whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</span>
                </td>
                <td className={tdBase}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => { e.stopPropagation(); onDelete(u); }}
                    disabled={isSelf}
                    aria-label={`Delete ${u.username}`}
                    className="text-[var(--destructive)] hover:text-[var(--destructive)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type SortDirection, SortHeader } from '@/components/ui/sort-header';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
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

export function AdminUsersTable({
  users,
  currentUserId,
  sortColumn,
  sortDirection,
  onSort,
  onDelete,
  onClickUser,
}: AdminUsersTableProps) {
  return (
    <Table>
      <TableHeader>
        <div className="flex-1 min-w-0">
          <SortHeader label="User" column="username" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSort} />
        </div>
        <div className="hidden lg:block w-40">
          <SortHeader label="Email" column="email" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSort} />
        </div>
        <div className="w-16">
          <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Role</span>
        </div>
        <div className="w-16">
          <SortHeader label="Plan" column="plan" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSort} />
        </div>
        <div className="w-24">
          <SortHeader label="Status" column="status" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSort} />
        </div>
        <div className="hidden lg:block w-14 text-right">
          <SortHeader label="Bins" column="bins" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSort} defaultDirection="desc" className="justify-end" />
        </div>
        <div className="hidden lg:block w-14 text-right">
          <SortHeader label="Locs" column="locations" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSort} defaultDirection="desc" className="justify-end" />
        </div>
        <div className="hidden lg:block w-20 text-right">
          <SortHeader label="Storage" column="storage" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSort} defaultDirection="desc" className="justify-end" />
        </div>
        <div className="hidden sm:block w-24">
          <SortHeader label="Created" column="created" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSort} />
        </div>
        <div className="w-9" />
      </TableHeader>

      {users.map((u) => {
        const isSelf = u.id === currentUserId;
        return (
          <TableRow
            key={u.id}
            onClick={() => onClickUser(u.id)}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onClickUser(u.id); }}
            className={cn(u.deletedAt && 'opacity-50')}
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[14px] text-[var(--text-primary)] truncate">{u.displayName || u.username}</div>
              <div className="text-[12px] text-[var(--text-tertiary)] truncate">@{u.username}</div>
            </div>
            <div className="hidden lg:block w-40 text-[14px] text-[var(--text-secondary)] truncate">{u.email || '—'}</div>
            <div className="w-16 text-[14px]">
              {u.isAdmin ? <Badge variant="default" className="text-[11px]">Admin</Badge> : <span className="text-[var(--text-tertiary)]">—</span>}
            </div>
            <div className="w-16 text-[14px]">
              <Badge variant="secondary" className="text-[11px]">{capitalize(u.plan)}</Badge>
            </div>
            <div className="w-24 text-[14px]">
              <span className="flex items-center gap-1.5">
                {u.deletedAt && <Badge variant="destructive" className="text-[11px]">Deleted</Badge>}
                <Badge variant={statusVariant(u.status)} className="text-[11px]">{capitalize(u.status)}</Badge>
              </span>
            </div>
            <div className="hidden lg:block w-14 text-[14px] text-[var(--text-secondary)] text-right tabular-nums">{u.deletedAt ? '—' : u.binCount}</div>
            <div className="hidden lg:block w-14 text-[14px] text-[var(--text-secondary)] text-right tabular-nums">{u.deletedAt ? '—' : u.locationCount}</div>
            <div className="hidden lg:block w-20 text-[14px] text-[var(--text-secondary)] text-right tabular-nums">{u.deletedAt ? '—' : `${u.photoStorageMb} MB`}</div>
            <div className="hidden sm:block w-24">
              <span className="text-[12px] text-[var(--text-tertiary)] whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="w-9 flex justify-center">
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
            </div>
          </TableRow>
        );
      })}
    </Table>
  );
}

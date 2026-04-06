import { generateUuid, query } from '../db.js';

export interface AuditEntry {
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetName?: string | null;
  details?: Record<string, unknown> | null;
}

/** Fire-and-forget admin audit log entry. Never throws. */
export function logAdminAction(entry: AuditEntry): void {
  const id = generateUuid();
  query(
    `INSERT INTO admin_audit_log (id, actor_id, actor_name, action, target_type, target_id, target_name, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      entry.actorId,
      entry.actorName,
      entry.action,
      entry.targetType,
      entry.targetId ?? null,
      entry.targetName ?? null,
      entry.details ? JSON.stringify(entry.details) : null,
    ],
  ).catch(() => {});
}

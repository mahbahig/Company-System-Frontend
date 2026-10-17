import type { AuditActionLabel } from '../../../core/audit/audit-action-label';

/** One changed field: before → after, or — for a secret (password, token, stamp …) — changed without any value. */
export interface AuditChange {
  field: string;
  before?: unknown;
  after?: unknown;
  sensitive?: boolean;
}

/** One audit event as the API returns it (list and detail). */
export interface AuditEntry {
  id: string;
  /** When it happened. */
  occurredAt: string;
  actorId?: string | null;
  /** The actor's names when it happened (snapshots). */
  actorName?: string | null;
  actorNameAr?: string | null;
  /** A signed-in user, an unauthenticated request (a failed sign-in …), or the system (jobs, automation). */
  actorKind: 'user' | 'anonymous' | 'system';
  /** The code, for filtering only — people read `actionLabel`. */
  action: string;
  actionLabel: AuditActionLabel;
  entityType: string;
  entityId?: string | null;
  changedFields: string[];
  /** What changed, field by field (only changed fields). */
  changes?: AuditChange[];
  /** The employee the event is about (events on a user account). */
  target?: { id: string; name: string | null; nameAr: string | null } | null;
  requestId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  source: string;
  severity: string;
  ip?: string | null;
  userAgent?: string | null;
}

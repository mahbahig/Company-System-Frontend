import type { I18nService } from '../../../core/i18n/i18n.service';
import { auditActionLabel, auditEntityLabel } from '../../../core/audit/audit-action-label';
import type { AuditEntry } from './audit-entry.interface';

/**
 * How an audit event reads, the same in the list and the detail: the
 * readable action, who did it (the person's name — "System" only for jobs
 * and automation, "Not signed in" for an unauthenticated request), the date
 * and time on the 12-hour clock, and the record type in words.
 */
export function auditAction(i18n: I18nService, entry: Pick<AuditEntry, 'action' | 'actionLabel'>): string {
  return auditActionLabel(i18n, entry.action, entry.actionLabel);
}

export function auditActor(i18n: I18nService, entry: Pick<AuditEntry, 'actorKind' | 'actorName' | 'actorNameAr'>): string {
  if (entry.actorKind === 'user') return i18n.pick(entry.actorNameAr || entry.actorName || '', entry.actorName || entry.actorNameAr || '') || '—';
  return i18n.t(entry.actorKind === 'system' ? 'admin.audit.system' : 'admin.audit.anonymous');
}

export function auditTime(i18n: I18nService, entry: Pick<AuditEntry, 'occurredAt'>): string {
  return i18n.formatDate(entry.occurredAt, true);
}

export function auditRecord(i18n: I18nService, entry: Pick<AuditEntry, 'entityType'>): string {
  return auditEntityLabel(i18n, entry.entityType);
}

/** Where a record of this type opens in the application (checked with `canOpen` before linking). */
export const RECORD_PATHS: Readonly<Record<string, string>> = {
  lead: 'leads',
  customer: 'customers',
  opportunity: 'opportunities',
  contact: 'contacts',
  project: 'projects',
  task: 'tasks',
  meeting: 'meetings',
  visit: 'visits',
  call: 'calls',
  contract: 'contracts',
  support_ticket: 'support',
  user: 'employees',
};

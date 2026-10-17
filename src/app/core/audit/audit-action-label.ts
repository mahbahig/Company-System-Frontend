import type { I18nService } from '../i18n/i18n.service';

/** The readable action the API sends with every audit event (`actionLabel`), in both languages. */
export interface AuditActionLabel {
  en: string;
  ar: string;
}

/**
 * The one place an audit action becomes words for people. The catalogue
 * lives in the API (`AUDIT_ACTION_LABELS`, complete for every action by
 * type) and arrives with each event; this picks the active language. Without
 * one (never expected) the code is still turned into words — a raw code such
 * as `auth.login` is never shown.
 */
export function auditActionLabel(i18n: I18nService, action: string, label?: AuditActionLabel | null): string {
  if (label?.en || label?.ar) return i18n.pick(label.ar || label.en, label.en || label.ar);
  return humanize(action);
}

/** "Lead", "Support ticket" … for an audited record type (words, never the code). */
export function auditEntityLabel(i18n: I18nService, entityType: string): string {
  const key = `admin.audit.entities.${entityType}`;
  const label = i18n.t(key);
  return label && label !== key ? label : humanize(entityType);
}

/** `support_ticket.status_change` → "Support ticket: status change". */
function humanize(code: string): string {
  const [subject, ...rest] = code.split('.').map((part) => part.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().trim());
  const sentence = rest.length ? `${subject}: ${rest.join(' ')}` : (subject ?? '');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

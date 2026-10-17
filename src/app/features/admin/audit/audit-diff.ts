import type { I18nService } from '../../../core/i18n/i18n.service';
import type { AuditChange } from './audit-entry.interface';

/** Fields whose values are enum codes, with the enum (or i18n prefix) that words them. */
const ENUM_FIELDS: Readonly<Record<string, string>> = {
  roleCodes: 'enums.roleCode',
  'availability.status': 'enums.availabilityStatus',
  priority: 'enums.priority',
  scope: 'enums.scope',
};

/** `status` reads differently per record. */
const STATUS_ENUMS: Readonly<Record<string, string>> = {
  lead: 'enums.leadStatus',
  task: 'enums.taskStatus',
  project: 'enums.projectStatus',
  contract: 'enums.contractStatus',
  meeting: 'enums.meetingStatus',
  visit: 'enums.visitStatus',
  support_ticket: 'support.status',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const MAX_TEXT = 300;

/** A changed field's name in words: its own label when there is one, otherwise "leadCapacity" → "Lead capacity". */
export function auditFieldLabel(i18n: I18nService, field: string): string {
  const key = `admin.audit.fields.${field.replace(/\./g, '_')}`;
  if (i18n.has(key)) return i18n.t(key);
  const words = field
    .split('.')
    .map((part) => part.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase())
    .join(' › ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A value as people read it: "—" for nothing, Active / Inactive, Yes / No,
 * role and status names instead of codes, dates on the 12-hour clock, lists
 * joined — never raw JSON.
 */
export function auditValue(i18n: I18nService, change: Pick<AuditChange, 'field'>, value: unknown, entityType: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') {
    if (change.field === 'isActive') return i18n.t(value ? 'admin.active' : 'admin.inactive');
    return i18n.t(value ? 'admin.audit.detail.yes' : 'admin.audit.detail.no');
  }
  const prefix = change.field === 'status' ? STATUS_ENUMS[entityType] : ENUM_FIELDS[change.field];
  const word = (item: unknown): string => {
    if (item === null || item === undefined || item === '') return '—';
    if (typeof item === 'string') {
      if (prefix && i18n.has(`${prefix}.${item}`)) return i18n.t(`${prefix}.${item}`);
      if (ISO_DATE.test(item)) return i18n.formatDate(item, true);
      return item.length > MAX_TEXT ? `${item.slice(0, MAX_TEXT)}…` : item;
    }
    if (typeof item === 'number') return i18n.formatNumber(item);
    if (typeof item === 'boolean') return i18n.t(item ? 'admin.audit.detail.yes' : 'admin.audit.detail.no');
    if (Array.isArray(item)) return item.map(word).join(', ') || '—';
    if (typeof item === 'object') {
      return Object.entries(item as Record<string, unknown>)
        .map(([key, inner]) => `${auditFieldLabel(i18n, key)}: ${word(inner)}`)
        .join(' · ');
    }
    return String(item);
  };
  return word(value);
}

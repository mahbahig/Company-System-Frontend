import type { I18nService } from '../../../core/i18n/i18n.service';
import type { BadgeTone } from '../../../shared/ui/badge/badge-variants';
import type { SupportTicketSeverity, SupportTicketStatus } from '../models/support-ticket.interface';

/**
 * Status colours: new and reopened tickets wait on the support desk (amber /
 * blue), resolved is done but may come back (green), closed is final (grey,
 * with a lock in the badge) — resolved and closed never look alike.
 */
export const SUPPORT_STATUS_TONE: Record<SupportTicketStatus, BadgeTone> = {
  pending: 'warning',
  reopened: 'info',
  resolved: 'success',
  closed: 'neutral',
};

export const SUPPORT_STATUSES: SupportTicketStatus[] = ['pending', 'reopened', 'resolved', 'closed'];

/** The four severities, mildest first (the API's `SupportTicketSeverity`). */
export const SUPPORT_SEVERITIES: readonly SupportTicketSeverity[] = ['low', 'medium', 'high', 'critical'];
/** What a new ticket starts with — the API's default when none is sent. */
export const DEFAULT_SUPPORT_SEVERITY: SupportTicketSeverity = 'medium';
/** A "crucial" ticket is a critical one (the dashboard and the Exceptions Center count these). */
export const CRUCIAL_SUPPORT_SEVERITY: SupportTicketSeverity = 'critical';
/** The statuses that wait for the support desk — what "new tickets" counts (the API's `AWAITING_DESK_SUPPORT_TICKET_STATUSES`), as one list filter. */
export const AWAITING_DESK_STATUS = 'pending,reopened';

/** Severity colours, rising with urgency; critical is the destructive tone. */
export const SUPPORT_SEVERITY_TONE: Record<SupportTicketSeverity, BadgeTone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};
export const SUPPORT_CATEGORIES = ['bug', 'technical_problem', 'account_access', 'feature_request', 'other'] as const;

/** A file size in the active locale, e.g. "2.4 MB" / "٢٫٤ ميغابايت". */
export function fileSize(i18n: I18nService, bytes: number): string {
  if (bytes < 1024 * 1024) return i18n.formatNumber(Math.max(1, Math.round(bytes / 1024)), { style: 'unit', unit: 'kilobyte' });
  return i18n.formatNumber(bytes / (1024 * 1024), { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 });
}

/** A one-off notice handed to the next page through navigation state (e.g. "ticket submitted"). */
export function takeNotice(): string | null {
  const state = (typeof history !== 'undefined' ? history.state : null) as { supportNotice?: unknown } | null;
  return typeof state?.supportNotice === 'string' ? state.supportNotice : null;
}

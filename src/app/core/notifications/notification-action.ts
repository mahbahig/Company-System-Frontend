import type { AppNotification } from './notification.interface';

/** Categories that ask the recipient to decide or check something (backend `NotificationCategory`). */
const REVIEW_CATEGORIES = new Set([
  'approval.requested',
  'approval.reminder',
  'approval.escalated',
  'tp.submitted',
  'assessment.submitted',
  'fp.validation_required',
  'cp.pending_approval',
  'handoff.submitted',
  'handoff.clarification',
  'delivery_handover.submitted',
  'delivery_handover.confirmation_needed',
  'change_request.pending',
  'lead.handoff_pending',
  'ownership.requested',
  'ownership.conflict',
  'duplicate.detected',
  'duplicate.flagged',
  'duplicate.merge_requested',
  'information.requested',
  'contract.awaiting_signature',
]);

const TASK_CATEGORIES = new Set(['task.assigned', 'task.overdue']);

export type NotificationActionKind = 'review' | 'openTask' | 'open';

/** The verb of a notification's button: "Review", "Open task" or "Open". */
export function notificationAction(notification: Pick<AppNotification, 'category'>): NotificationActionKind {
  if (REVIEW_CATEGORIES.has(notification.category)) return 'review';
  if (TASK_CATEGORIES.has(notification.category)) return 'openTask';
  return 'open';
}

export interface NotificationTarget {
  /** Router commands, e.g. `['/approvals/123']`. */
  commands: string[];
  queryParams: Record<string, string>;
  /** The path (for `canOpen`). */
  path: string;
}

/**
 * Where a notification leads — only when the route guard would let this user
 * open it (`canOpen`); otherwise null and the notification is shown without
 * a link. The query string is kept as query params (a path containing `?`
 * would be URL-encoded by the router and break the link).
 */
export function notificationTarget(
  actionUrl: string | null | undefined,
  canOpen: (path: string) => boolean,
): NotificationTarget | null {
  if (!actionUrl || /^[a-z]+:\/\//i.test(actionUrl)) return null;
  const [rawPath, query = ''] = actionUrl.split('?');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  if (!canOpen(path)) return null;
  const queryParams: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(query)) queryParams[key] = value;
  return { commands: [path], queryParams, path };
}

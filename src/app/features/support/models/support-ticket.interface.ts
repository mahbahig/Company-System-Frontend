import type { UserRef } from '../../../core/auth/models/user-ref.interface';

/** Backend `SupportTicketStatus`: pending → resolved → (the employee) reopened → resolved … → closed (final). */
export type SupportTicketStatus = 'pending' | 'resolved' | 'reopened' | 'closed';

/** One lifecycle step (created, resolved, reopened, permanently closed), with who made it. */
export interface SupportTicketHistoryEntry {
  from: SupportTicketStatus | null;
  to: SupportTicketStatus;
  at: string;
  byId: string;
  byNameEn: string;
  byNameAr: string;
  byRole: 'requester' | 'support';
}
export type SupportTicketCategory = 'bug' | 'technical_problem' | 'account_access' | 'feature_request' | 'other';
/** Backend `SupportTicketSeverity`; `critical` is a crucial ticket. The list of values lives in `SUPPORT_SEVERITIES`. */
export type SupportTicketSeverity = 'low' | 'medium' | 'high' | 'critical';

/** A support ticket (backend `SupportTicketResponse`); lists leave out the description. */
export interface SupportTicket {
  id: string;
  ticketNo: string;
  title: string;
  description?: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  severity: SupportTicketSeverity;
  requesterId: string;
  requesterNameAr: string;
  requesterNameEn: string;
  requesterEmail: string;
  lastActivityAt: string;
  commentCount: number;
  attachmentCount: number;
  resolvedAt?: string | null;
  resolvedBy?: UserRef | string | null;
  reopenedAt?: string | null;
  reopenCount?: number;
  closedAt?: string | null;
  closedBy?: string | null;
  /** Every lifecycle step, oldest first (detail; lists may carry it too). */
  history?: SupportTicketHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

import type { UserRef } from '../../../core/auth/models/user-ref.interface';
import type { SupportTicket, SupportTicketStatus } from './support-ticket.interface';

/** One message in a ticket's conversation. */
export interface SupportTicketComment {
  id: string;
  ticketId: string;
  authorId: UserRef | string;
  /** The employee who filed the ticket, or the support desk. */
  authorRole: 'requester' | 'support';
  body: string;
  createdAt: string;
}

/** A screenshot, reachable only through its short-lived signed link. */
export interface SupportTicketAttachment {
  id: string;
  fileName: string;
  contentType: string;
  bytes: number;
  width: number;
  height: number;
  createdAt?: string;
  expiresAt: number;
  signature: string;
}

/** What the signed-in user may do on the ticket — computed by the API. */
export interface SupportTicketPermissions {
  canComment: boolean;
  canChangeStatus: boolean;
  /** The support desk's moves from here (resolve, close permanently). */
  nextStatuses: SupportTicketStatus[];
  /** The employee who filed it may reopen it (it is resolved). */
  canReopen: boolean;
  canDelete: boolean;
  canDeleteAttachments: boolean;
}

/** `GET /support/tickets/:id`. */
export interface SupportTicketDetail {
  ticket: SupportTicket;
  comments: SupportTicketComment[];
  attachments: SupportTicketAttachment[];
  permissions: SupportTicketPermissions;
}

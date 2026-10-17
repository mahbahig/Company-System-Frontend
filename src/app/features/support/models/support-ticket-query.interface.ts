import type { SupportTicketCategory, SupportTicketSeverity, SupportTicketStatus } from './support-ticket.interface';

/** Query of the ticket lists (`GET /support/tickets` and `/support/tickets/mine`). */
export interface SupportTicketQuery {
  q?: string;
  status?: SupportTicketStatus;
  category?: SupportTicketCategory;
  severity?: SupportTicketSeverity;
  page?: number;
  pageSize?: number;
}

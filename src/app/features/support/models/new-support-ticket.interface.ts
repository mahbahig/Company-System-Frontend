import type { SupportTicketCategory, SupportTicketSeverity } from './support-ticket.interface';

/** The new-ticket form. Who files it is never sent: the API takes the signed-in user. */
export interface NewSupportTicket {
  title: string;
  description: string;
  category: SupportTicketCategory;
  severity: SupportTicketSeverity;
  screenshots: File[];
}

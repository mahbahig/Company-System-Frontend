/** What the support desk has waiting (`GET /support/tickets/stats`). */
export interface SupportTicketStats {
  /** Tickets awaiting the desk (pending), whatever their severity. */
  newTickets: number;
  /** Of those, the critical (crucial) ones. */
  criticalNewTickets: number;
}

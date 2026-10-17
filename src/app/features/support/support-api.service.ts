import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { UploadProgress } from '../../core/api/upload-progress.interface';
import type { NewSupportTicket } from './models/new-support-ticket.interface';
import type { SupportAttachmentPolicy } from './models/support-attachment-policy.interface';
import type { SupportTicketAttachment, SupportTicketComment, SupportTicketDetail } from './models/support-ticket-detail.interface';
import type { SupportTicketQuery } from './models/support-ticket-query.interface';
import type { SupportTicketStats } from './models/support-ticket-stats.interface';
import type { SupportTicket, SupportTicketStatus } from './models/support-ticket.interface';

/** Typed client for Help & Support (`/support/tickets`). The API enforces who may call what. */
@Service()
export class SupportApi {
  private readonly api = inject(ApiService);

  /** The signed-in user's own tickets. */
  mine(query: SupportTicketQuery): Observable<Page<SupportTicket>> {
    return this.api.get<Page<SupportTicket>>('support/tickets/mine', { ...query });
  }

  /** Every ticket (support desk only). */
  all(query: SupportTicketQuery): Observable<Page<SupportTicket>> {
    return this.api.get<Page<SupportTicket>>('support/tickets', { ...query });
  }

  get(id: string): Observable<SupportTicketDetail> {
    return this.api.get<SupportTicketDetail>(`support/tickets/${id}`);
  }

  /** What the support desk has waiting — counted by the API (support desk only). */
  stats(): Observable<SupportTicketStats> {
    return this.api.get<SupportTicketStats>('support/tickets/stats');
  }

  attachmentPolicy(): Observable<SupportAttachmentPolicy> {
    return this.api.get<SupportAttachmentPolicy>('support/tickets/attachment-policy');
  }

  /** Files the ticket with its screenshots in one multipart request, reporting upload progress. */
  create(ticket: NewSupportTicket): Observable<UploadProgress<SupportTicket>> {
    const body = new FormData();
    body.set('title', ticket.title);
    body.set('description', ticket.description);
    body.set('category', ticket.category);
    body.set('severity', ticket.severity);
    for (const file of ticket.screenshots) body.append('attachments', file, file.name);
    return this.api.uploadWithProgress<SupportTicket>('support/tickets', body);
  }

  comment(id: string, body: string): Observable<SupportTicketComment> {
    return this.api.post<SupportTicketComment>(`support/tickets/${id}/comments`, { body });
  }

  /** The employee who filed it reopens a resolved ticket — the same ticket, back with the desk. */
  reopen(id: string, comment?: string): Observable<SupportTicket> {
    return this.api.patch<SupportTicket>(`support/tickets/${id}/reopen`, { comment: comment || undefined });
  }

  /** The support desk: resolve, or close permanently. */
  changeStatus(id: string, status: SupportTicketStatus, comment?: string): Observable<SupportTicket> {
    return this.api.patch<SupportTicket>(`support/tickets/${id}/status`, { status, comment: comment || undefined });
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`support/tickets/${id}`);
  }

  /** `confirmation` must be the exact words the API expects (`DELETE ALL`). */
  removeAll(confirmation: string): Observable<{ deletedTickets: number; deletedComments: number; deletedAttachments: number }> {
    return this.api.post(`support/tickets/delete-all`, { confirmation });
  }

  removeAttachment(id: string, attachmentId: string): Observable<void> {
    return this.api.delete<void>(`support/tickets/${id}/attachments/${attachmentId}`);
  }

  /** The screenshot's signed link (valid for a few minutes; the detail hands out fresh ones). */
  attachmentUrl(ticketId: string, attachment: Pick<SupportTicketAttachment, 'id' | 'expiresAt' | 'signature'>): string {
    return `${this.api.url(`support/tickets/${ticketId}/attachments/${attachment.id}/content`)}?expiresAt=${attachment.expiresAt}&signature=${encodeURIComponent(attachment.signature)}`;
  }
}

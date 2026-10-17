import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CircleCheck, ExternalLink, Lock, RotateCcw, Send, Trash2 } from 'lucide';
import { tap } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { userName } from '../../../shared/utils/display-name';
import { StatusPageComponent } from '../../errors/status-page.component';
import type { SupportTicketAttachment, SupportTicketComment } from '../models/support-ticket-detail.interface';
import type { SupportTicketHistoryEntry, SupportTicketStatus } from '../models/support-ticket.interface';
import { fileSize, SUPPORT_STATUS_TONE, takeNotice } from '../shared/support-display';
import { SupportSeverityBadgeComponent } from '../shared/support-severity-badge.component';
import { SupportApi } from '../support-api.service';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';

/**
 * One support ticket: what was reported, the screenshots, the conversation,
 * its lifecycle history and — only where the API's permission flags allow —
 * what the viewer may do: the support desk resolves or permanently closes it
 * (and deletes it or a screenshot); the employee who filed it reopens it
 * while it is resolved (the same ticket). A closed ticket says so and offers
 * nothing. Every action asks a contextual confirmation and runs inside it.
 */
@Component({
  selector: 'app-support-ticket-detail-page',
  imports: [AvatarComponent, 
    TranslatePipe,
    BreadcrumbsComponent,
    DetailItemComponent,
    AlertComponent,
    BadgeComponent,
    ButtonDirective,
    DialogComponent,
    IconComponent,
    PageHeaderComponent,
    DetailSkeletonComponent,
    StatusPageComponent,
    SupportSeverityBadgeComponent,
    ...CARD_IMPORTS,
    ...FORM_IMPORTS,
  ],
  templateUrl: './support-ticket-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class SupportTicketDetailPage {
  private readonly api = inject(SupportApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  /** Route param. */
  readonly id = input.required<string>();

  protected readonly icons = { resolve: CircleCheck, reopen: RotateCcw, close: Lock, remove: Trash2, send: Send, open: ExternalLink };
  protected readonly tone = SUPPORT_STATUS_TONE;
  protected readonly notice = signal<string | null>(takeNotice());
  protected readonly reply = signal('');
  protected readonly note = signal('');
  /** The employee's optional reason when reopening. */
  protected readonly reopenReason = signal('');
  protected readonly viewing = signal<SupportTicketAttachment | null>(null);
  protected readonly lightboxOpen = signal(false);
  private refreshedLinks = false;

  protected readonly detail = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get(params) });
  protected readonly data = computed(() => (this.detail.hasValue() ? this.detail.value() : null));
  protected readonly notFound = computed(() => {
    const error = this.detail.error();
    return ApiError.is(error) && (error.status === 404 || error.status === 400);
  });
  /** The support desk manages tickets; its way back is the desk's list. */
  protected readonly manages = computed(() => !!this.data()?.permissions.canChangeStatus);
  protected readonly crumbs = computed(() => {
    const ticket = this.data()?.ticket;
    const back = this.manages() ? { label: this.i18n.t('navigation.items.supportTickets'), path: '/admin/support-tickets' } : { label: this.i18n.t('navigation.items.support'), path: '/support' };
    return [back, { label: ticket?.ticketNo ?? '' }];
  });
  protected readonly requester = computed(() => {
    const ticket = this.data()?.ticket;
    return ticket ? this.i18n.pick(ticket.requesterNameAr, ticket.requesterNameEn) : '';
  });
  protected readonly resolver = computed(() => userName((ar, en) => this.i18n.pick(ar, en), this.data()?.ticket.resolvedBy));

  /** The author as a reference (for their picture). */
  protected authorRef(comment: SupportTicketComment) {
    return typeof comment.authorId === 'object' ? comment.authorId : null;
  }

  protected author(comment: SupportTicketComment): string {
    const id = typeof comment.authorId === 'object' ? comment.authorId?.id : comment.authorId;
    if (id === this.auth.user()?.id) return this.i18n.t('support.detail.you');
    return userName((ar, en) => this.i18n.pick(ar, en), comment.authorId);
  }

  protected url(attachment: SupportTicketAttachment): string {
    return this.api.attachmentUrl(this.id(), attachment);
  }

  protected size(bytes: number): string {
    return fileSize(this.i18n, bytes);
  }

  /** Signed links expire after a few minutes: a broken image fetches fresh ones once. */
  protected linkExpired(): void {
    if (this.refreshedLinks) return;
    this.refreshedLinks = true;
    this.detail.reload();
  }

  protected open(attachment: SupportTicketAttachment): void {
    this.viewing.set(attachment);
    this.lightboxOpen.set(true);
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    const body = this.reply().trim();
    if (!body || this.actions.busy()) return;
    this.notice.set(null);
    await this.actions.run(this.api.comment(this.id(), body), 'support.notices.commented', () => {
      this.reply.set('');
      this.detail.reload();
    });
  }

  /** The desk: resolve (the employee may still reopen) or close permanently (final) — each with its own confirmation. */
  protected async move(status: SupportTicketStatus): Promise<void> {
    const ticket = this.data()?.ticket;
    if (!ticket) return;
    const closing = status === 'closed';
    const params = { number: ticket.ticketNo, name: this.requester() };
    this.notice.set(null);
    this.actions.message.set(null);
    const done = await this.confirm.confirm({
      heading: this.i18n.t(closing ? 'support.confirm.closeTicketTitle' : 'support.confirm.resolveTicketTitle', params),
      message: this.i18n.t(closing ? 'support.confirm.closeTicketBody' : 'support.confirm.resolveTicketBody', params),
      details: [this.i18n.t(closing ? 'support.confirm.closeTicketKept' : 'support.confirm.resolveTicketReopen', params)],
      irreversible: closing,
      confirmLabel: this.i18n.t(closing ? 'support.actions.closePermanently' : 'support.actions.resolveTicket'),
      cancelLabel: this.i18n.t('support.confirm.cancel'),
      variant: closing ? 'danger' : 'default',
      action: () => this.api.changeStatus(this.id(), status, this.note().trim()),
    });
    if (!done) return;
    this.note.set('');
    this.actions.message.set(this.i18n.t(closing ? 'support.notices.closed' : 'support.notices.resolvedDesk'));
    this.detail.reload();
  }

  /** The employee who filed it, while it is resolved: the same ticket goes back to the desk. */
  protected async reopen(): Promise<void> {
    const ticket = this.data()?.ticket;
    if (!ticket) return;
    this.notice.set(null);
    this.actions.message.set(null);
    const done = await this.confirm.confirm({
      heading: this.i18n.t('support.confirm.reopenTicketTitle', { number: ticket.ticketNo }),
      message: this.i18n.t('support.confirm.reopenTicketBody'),
      details: [this.i18n.t('support.confirm.reopenTicketSame')],
      confirmLabel: this.i18n.t('support.actions.reopenTicket'),
      cancelLabel: this.i18n.t('support.confirm.cancel'),
      variant: 'default',
      action: () => this.api.reopen(this.id(), this.reopenReason().trim()),
    });
    if (!done) return;
    this.reopenReason.set('');
    this.actions.message.set(this.i18n.t('support.notices.reopenedByYou'));
    this.detail.reload();
  }

  /** "Created by …", "Resolved by …", "Reopened by …", "Permanently closed by …". */
  protected historyText(step: SupportTicketHistoryEntry): string {
    const name = this.i18n.pick(step.byNameAr || step.byNameEn, step.byNameEn || step.byNameAr);
    const key = step.from === null ? 'created' : step.to;
    return this.i18n.t(`support.history.${key}`, { name });
  }

  protected async deleteTicket(): Promise<void> {
    const ticket = this.data()?.ticket;
    if (!ticket) return;
    const done = await this.confirm.confirm({
      heading: this.i18n.t('support.confirm.deleteTicketTitle', { number: ticket.ticketNo }),
      message: this.i18n.t('support.confirm.deleteTicketBody'),
      irreversible: true,
      confirmLabel: this.i18n.t('support.actions.deleteTicket'),
      cancelLabel: this.i18n.t('support.confirm.cancel'),
      variant: 'danger',
      action: () => this.api.remove(this.id()),
    });
    if (!done) return;
    const back = this.manages() ? ['/', 'admin', 'support-tickets'] : ['/', 'support'];
    void this.router.navigate(back, { state: { supportNotice: 'support.notices.deleted' } });
  }

  protected async deleteAttachment(attachment: SupportTicketAttachment): Promise<void> {
    const done = await this.confirm.confirm({
      heading: this.i18n.t('support.confirm.deleteScreenshotTitle', { name: attachment.fileName }),
      message: this.i18n.t('support.confirm.deleteScreenshotBody'),
      irreversible: true,
      confirmLabel: this.i18n.t('support.actions.deleteScreenshot'),
      cancelLabel: this.i18n.t('support.confirm.cancel'),
      variant: 'danger',
      action: () => this.api.removeAttachment(this.id(), attachment.id).pipe(tap(() => this.lightboxOpen.set(false))),
    });
    if (!done) return;
    this.actions.message.set(this.i18n.t('support.notices.attachmentDeleted'));
    this.detail.reload();
  }
}

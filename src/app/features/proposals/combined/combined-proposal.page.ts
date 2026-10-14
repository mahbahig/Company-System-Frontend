import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { EvidenceSelectComponent } from '../../../shared/crm/evidence-select/evidence-select.component';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { ApiService } from '../../../core/api/api.service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { trackRecentView } from '../../../core/records/track-recent-view';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { FavoriteToggleComponent } from '../../../shared/crm/favorite-toggle/favorite-toggle.component';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CompletenessPanelComponent } from '../../../shared/crm/completeness-panel/completeness-panel.component';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { DocumentsPanelComponent } from '../../../shared/crm/documents-panel/documents-panel.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { userName } from '../../../shared/utils/display-name';
import type { Person } from '../proposals.models';
import { ProposalsApi } from '../proposals-api.service';

/**
 * PROP-01..23 combined customer proposal: assembly by the PM (template,
 * texts, generated or uploaded PDF), submission for approval, release to
 * Sales, delivery log (locks the version), customer response, share link,
 * "mark final" and resend after expiry. The responsible Technical Author and
 * Financial Preparer are always shown.
 */
@Component({
  selector: 'app-combined-proposal-page',
  imports: [BreadcrumbsComponent, FavoriteToggleComponent, DetailSkeletonComponent, EvidenceSelectComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, CompletenessPanelComponent, DetailItemComponent, DocumentsPanelComponent, UserSelectComponent, AlertComponent, BadgeComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './combined-proposal.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class CombinedProposalPage {
  protected readonly api = inject(ProposalsApi);
  private readonly http = inject(ApiService);
  protected readonly i18n = inject(I18nService);
  protected readonly navigation = inject(NavigationService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly id = input.required<string>();

  protected readonly data = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.combined(params) });
  protected readonly proposal = computed(() => this.data.value()?.proposal);
  protected readonly reload = () => this.data.reload();

  protected readonly texts = signal({ title: '', introduction: '', customerNotes: '', terms: '', templateCode: 'standard', language: 'ar' });
  protected readonly attachId = signal('');
  protected readonly delivery = signal({ channel: 'meeting', at: '', recipients: '', presenterId: '', notes: '', nextFollowUpAt: '' });
  /** O8 acceptance: the exact version, the evidence type and the document attached to this version. */
  protected readonly acceptance = signal({ evidenceType: 'signed_quotation', documentId: '', acceptedAt: '', contractingParty: '', signatoryName: '', signatoryTitle: '', purchaseOrderNo: '' });
  protected readonly response = signal({ response: 'accepted', feedback: '', questions: '', requestedModifications: '', nextAction: '', nextActionAt: '' });
  protected readonly shareForm = signal({ channel: 'email' as 'email' | 'whatsapp' | 'portal', recipients: '', expiresInDays: 14, message: '' });
  protected readonly shareResult = signal<{ url: string; expiresAt: string } | null>(null);

  protected readonly opportunityId = computed(() => {
    const opp = this.data.value()?.opportunity;
    return String(opp?.id ?? opp?._id ?? this.proposal()?.opportunityId ?? '');
  });

  protected readonly notFound = computed(() => {
    const error = this.data.error();
    return ApiError.is(error) && (error.status === 404 || error.status === 400);
  });
  /** Proposals / <opportunity> / <proposal no. · version>. */
  protected readonly crumbs = computed(() => {
    const d = this.data.value();
    const p = this.proposal();
    return [
      { label: this.i18n.t('navigation.items.proposals'), path: '/proposals' },
      { label: d?.opportunity.name ?? '', path: this.opportunityId() ? `/opportunities/${this.opportunityId()}` : undefined },
      { label: p ? `${p.proposalNo} · v${p.versionNo}` : '' },
    ];
  });

  constructor() {
    trackRecentView('proposal', () => this.id(), () => (this.proposal() ? 'loaded' : this.notFound() ? 'missing' : 'pending'));
    effect(() => {
      const p = this.proposal();
      if (!p) return;
      this.texts.set({ title: p.title ?? '', introduction: p.introduction ?? '', customerNotes: p.customerNotes ?? '', terms: p.terms ?? '', templateCode: p.templateCode, language: p.language });
    });
  }

  protected setText(key: string, value: string): void {
    this.texts.update((t) => ({ ...t, [key]: value }));
  }

  protected setDelivery(key: string, value: string): void {
    this.delivery.update((d) => ({ ...d, [key]: value }));
  }

  protected setResponse(key: string, value: string): void {
    this.response.update((r) => ({ ...r, [key]: value }));
  }

  protected setShare(key: string, value: string | number): void {
    this.shareForm.update((s) => ({ ...s, [key]: value }));
  }

  protected name(value: Person): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value ?? null);
  }

  protected saveTexts(event: Event): void {
    event.preventDefault();
    void this.actions.run(this.api.updateCombined(this.id(), this.texts()), 'prop.saved', this.reload);
  }

  protected deliver(event: Event): void {
    event.preventDefault();
    const d = this.delivery();
    void this.actions.run(
      this.api.deliver(this.id(), {
        channel: d.channel,
        at: d.at ? new Date(d.at).toISOString() : undefined,
        recipients: d.recipients.split('\n').map((line) => line.trim()).filter(Boolean),
        presenterIds: d.presenterId ? [d.presenterId] : undefined,
        notes: d.notes.trim() || undefined,
        nextFollowUpAt: new Date(d.nextFollowUpAt).toISOString(),
      }),
      'prop.delivered',
      this.reload,
    );
  }

  protected setAcceptance(key: string, value: string): void {
    this.acceptance.update((a) => ({ ...a, [key]: value }));
  }

  protected accept(event: Event, versionNo: number): void {
    event.preventDefault();
    const a = this.acceptance();
    void this.actions.run(
      this.api.accept(this.id(), {
        acceptedVersionNo: versionNo,
        evidenceType: a.evidenceType as 'signed_quotation',
        documentId: a.documentId,
        acceptedAt: new Date(a.acceptedAt).toISOString(),
        contractingParty: a.contractingParty.trim(),
        signatoryName: a.signatoryName.trim(),
        signatoryTitle: a.signatoryTitle.trim() || undefined,
        purchaseOrderNo: a.purchaseOrderNo.trim() || undefined,
      }),
      'prop.acceptance.recorded',
      this.reload,
    );
  }

  protected recordFeedback(event: Event): void {
    event.preventDefault();
    const r = this.response();
    void this.actions.run(
      this.api.feedback(this.id(), {
        response: r.response,
        feedback: r.feedback.trim() || undefined,
        questions: r.questions.trim() || undefined,
        requestedModifications: r.requestedModifications.trim() || undefined,
        nextAction: r.nextAction.trim() || undefined,
        nextActionAt: r.nextActionAt ? new Date(r.nextActionAt).toISOString() : undefined,
      }),
      'prop.saved',
      this.reload,
    );
  }

  protected share(event: Event): void {
    event.preventDefault();
    const s = this.shareForm();
    void this.actions.run(
      this.api.share(this.id(), { channel: s.channel, recipients: s.recipients.split('\n').map((line) => line.trim()).filter(Boolean), expiresInDays: s.expiresInDays, message: s.message.trim() || undefined }),
      null,
      (result) => this.shareResult.set(result),
    );
  }

  /** Opens the proposal PDF through a short-lived signed link. */
  protected async openDocument(documentId: string): Promise<void> {
    try {
      const signed = await firstValueFrom(this.http.get<{ expiresAt: number; signature: string }>(`documents/${documentId}/download-url`));
      window.open(`${this.http.url(`documents/${documentId}/raw`)}?expiresAt=${signed.expiresAt}&signature=${encodeURIComponent(signed.signature)}`, '_blank', 'noopener');
    } catch (error) {
      this.actions.error.set(this.i18n.errorText(error));
    }
  }

  protected ref(value: unknown, key: 'number' | 'versionNo' | 'id'): string {
    return value && typeof value === 'object' ? String((value as Record<string, unknown>)[key] ?? '') : '';
  }
}

import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { TabsComponent } from '../../../shared/ui/tabs/tabs.component';
import type { TabItem } from '../../../shared/ui/tabs/tab-item.interface';
import { userName } from '../../../shared/utils/display-name';
import type { NegotiationEvent, Person, RegisterRow, RevisionRequest } from '../proposals.models';
import { ProposalsApi } from '../proposals-api.service';

/**
 * One opportunity's commercial workspace: technical, financial and combined
 * proposal versions, the customer-facing Proposal Register (PROP-17),
 * revision requests tracked to closure (PROP-18..20) and the structured
 * negotiation log (NEG-01..04).
 */
@Component({
  selector: 'app-proposals-workspace-page',
  imports: [RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, AlertComponent, BadgeComponent, ButtonDirective, PageHeaderComponent, TabsComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS],
  templateUrl: './proposals-workspace.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ProposalsWorkspacePage {
  private readonly api = inject(ProposalsApi);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  /** Opportunity id. */
  readonly id = input.required<string>();
  readonly tab = input<string>();

  protected readonly tabs = computed<TabItem[]>(() =>
    [
      { id: 'technical', label: this.i18n.t('prop.tabs.technical'), show: this.auth.can('technical_proposals.view') },
      { id: 'financial', label: this.i18n.t('prop.tabs.financial'), show: this.auth.can('financial_proposals.view') },
      { id: 'combined', label: this.i18n.t('prop.tabs.combined'), show: this.auth.can('combined_proposals.view') },
      { id: 'register', label: this.i18n.t('prop.tabs.register'), show: this.auth.can('combined_proposals.view') },
      { id: 'revisions', label: this.i18n.t('prop.tabs.revisions'), show: this.auth.can('combined_proposals.view') },
      { id: 'negotiations', label: this.i18n.t('prop.tabs.negotiations'), show: this.auth.can('negotiations.view') },
    ]
      .filter((tab) => tab.show)
      .map(({ id, label }) => ({ id, label })),
  );
  protected readonly active = computed(() => (this.tabs().some((tab) => tab.id === this.tab()) ? (this.tab() as string) : (this.tabs()[0]?.id ?? 'combined')));

  protected readonly technical = rxResource({ params: () => (this.active() === 'technical' || this.active() === 'financial' || this.active() === 'combined' ? this.id() : undefined), stream: ({ params }) => (params ? this.api.technicalList({ opportunityId: params, pageSize: 100 }) : of(undefined)) });
  protected readonly financial = rxResource({ params: () => (this.active() === 'financial' || this.active() === 'combined' ? this.id() : undefined), stream: ({ params }) => (params ? this.api.financialList({ opportunityId: params, pageSize: 100 }) : of(undefined)) });
  protected readonly combined = rxResource({ params: () => (['combined', 'revisions', 'negotiations'].includes(this.active()) ? this.id() : undefined), stream: ({ params }) => (params ? this.api.combinedList({ opportunityId: params, pageSize: 100 }) : of(undefined)) });
  protected readonly register = rxResource({ params: () => (this.active() === 'register' ? this.id() : undefined), stream: ({ params }) => (params ? this.api.register(params) : of(undefined)) });
  protected readonly revisions = rxResource({ params: () => (this.active() === 'revisions' ? this.id() : undefined), stream: ({ params }) => (params ? this.api.revisions({ opportunityId: params, pageSize: 100 }) : of(undefined)) });
  protected readonly negotiations = rxResource({ params: () => (this.active() === 'negotiations' ? this.id() : undefined), stream: ({ params }) => (params ? this.api.negotiations({ opportunityId: params }) : of(undefined)) });

  protected readonly approvedTps = computed(() => (this.technical.value()?.rows ?? []).filter((row) => row.status === 'approved'));
  protected readonly approvedFps = computed(() => (this.financial.value()?.rows ?? []).filter((row) => row.status === 'approved'));
  protected readonly facingCps = computed(() => (this.combined.value()?.rows ?? []).filter((row) => row.customerFacing));

  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly changeReason = signal('');
  protected readonly selectedTp = signal('');
  protected readonly selectedFp = signal('');
  protected readonly templateCode = signal('standard');
  protected readonly language = signal('ar');
  protected readonly compareIds = signal<string[]>([]);
  protected readonly revision = signal({ combinedProposalId: '', type: 'financial', details: '' });
  protected readonly rejectReason = signal('');
  protected readonly negotiation = signal({ combinedProposalId: '', typeCode: '', originalValue: '', requestedValue: '', valueUnit: 'text', objections: '', competitorName: '', competitorOffer: '', internalNotes: '', customerNotes: '', createRevisionRequest: false });

  constructor() {
    void this.reference.load();
  }

  protected selectTab(tab: string): void {
    void this.router.navigate([], { queryParams: { tab }, queryParamsHandling: 'merge' });
  }

  protected name(value: Person): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value ?? null);
  }

  protected rowId(row: { id?: string; _id?: string }): string {
    return String(row.id ?? row._id ?? '');
  }

  protected toggleCompare(row: RegisterRow): void {
    const id = this.rowId(row);
    this.compareIds.update((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id].slice(-2)));
  }

  protected compare(): void {
    const [a, b] = this.compareIds();
    void this.router.navigate(['/', this.i18n.locale(), 'proposals', 'compare'], { queryParams: { a, b } });
  }

  protected patchRevision(key: 'combinedProposalId' | 'type' | 'details', value: string): void {
    this.revision.update((r) => ({ ...r, [key]: value }));
  }

  protected patchNegotiation(key: string, value: string | boolean): void {
    this.negotiation.update((n) => ({ ...n, [key]: value }));
  }

  protected async newTechnical(): Promise<void> {
    const created = await this.act(this.api.createTechnical({ opportunityId: this.id(), changeReason: this.changeReason().trim() || undefined }), 'prop.created');
    if (created) void this.router.navigate(['/', this.i18n.locale(), 'proposals', 'technical', created.id]);
  }

  protected async newFinancial(): Promise<void> {
    const created = await this.act(this.api.createFinancial({ technicalProposalId: this.selectedTp(), changeReason: this.changeReason().trim() || undefined }), 'prop.created');
    if (created) void this.router.navigate(['/', this.i18n.locale(), 'proposals', 'financial', created.id]);
  }

  protected async newCombined(): Promise<void> {
    const created = await this.act(
      this.api.createCombined({ technicalProposalId: this.selectedTp(), financialProposalId: this.selectedFp(), templateCode: this.templateCode(), language: this.language(), changeReason: this.changeReason().trim() || undefined }),
      'prop.created',
    );
    if (created) void this.router.navigate(['/', this.i18n.locale(), 'proposals', 'combined', created.id]);
  }

  protected async requestRevision(event: Event): Promise<void> {
    event.preventDefault();
    const r = this.revision();
    if (await this.act(this.api.createRevision({ combinedProposalId: r.combinedProposalId, type: r.type, details: r.details.trim() }), 'prop.revision.created')) {
      this.revision.set({ combinedProposalId: '', type: 'financial', details: '' });
      this.revisions.reload();
    }
  }

  protected async startRevision(row: RevisionRequest): Promise<void> {
    if (await this.act(this.api.startRevision(row.id), 'prop.revision.started')) this.revisions.reload();
  }

  protected async rejectRevision(row: RevisionRequest): Promise<void> {
    if (await this.act(this.api.rejectRevision(row.id, this.rejectReason().trim()), 'prop.revision.rejected')) {
      this.rejectReason.set('');
      this.revisions.reload();
    }
  }

  protected async logNegotiation(event: Event): Promise<void> {
    event.preventDefault();
    const n = this.negotiation();
    const numeric = n.valueUnit !== 'text';
    const body = {
      opportunityId: this.id(),
      combinedProposalId: n.combinedProposalId || undefined,
      typeCode: n.typeCode,
      originalValue: n.originalValue === '' ? undefined : numeric ? Number(n.originalValue) : n.originalValue,
      requestedValue: n.requestedValue === '' ? undefined : numeric ? Number(n.requestedValue) : n.requestedValue,
      valueUnit: n.valueUnit,
      objections: n.objections.trim() || undefined,
      competitor: n.competitorName.trim() ? { name: n.competitorName.trim(), offer: n.competitorOffer.trim() || undefined } : undefined,
      internalNotes: n.internalNotes.trim() || undefined,
      customerNotes: n.customerNotes.trim() || undefined,
      createRevisionRequest: n.createRevisionRequest,
    };
    if (await this.act(this.api.createNegotiation(body), 'prop.negotiation.logged')) {
      this.negotiation.update((x) => ({ ...x, originalValue: '', requestedValue: '', objections: '', competitorName: '', competitorOffer: '', internalNotes: '', customerNotes: '', createRevisionRequest: false }));
      this.negotiations.reload();
    }
  }

  protected async setOutcome(row: NegotiationEvent, outcome: string): Promise<void> {
    if (await this.act(this.api.negotiationOutcome(row.id, { outcome }), 'prop.negotiation.updated')) this.negotiations.reload();
  }

  protected value(value: unknown, unit: string): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') return unit === 'pct' ? `${this.i18n.formatNumber(value)}%` : unit === 'egp' ? this.i18n.formatMoney(value) : unit === 'days' ? `${this.i18n.formatNumber(value)} ${this.i18n.t('kpi.units.days')}` : this.i18n.formatNumber(value);
    return String(value);
  }

  private async act<T>(action: Observable<T>, successKey: string): Promise<T | null> {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      const result = await firstValueFrom(action);
      this.message.set(this.i18n.t(successKey));
      return result;
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
      return null;
    } finally {
      this.busy.set(false);
    }
  }
}

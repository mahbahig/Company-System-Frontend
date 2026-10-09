import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CompletenessPanelComponent } from '../../../shared/crm/completeness-panel/completeness-panel.component';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { DocumentsPanelComponent } from '../../../shared/crm/documents-panel/documents-panel.component';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { userName } from '../../../shared/utils/display-name';
import type { Person } from '../../proposals/proposals.models';
import { ContractsApi } from '../contracts-api.service';

/**
 * CONTR-01..08 contract generated from the final proposal: value, payment
 * milestones, signatories, required-documents checklist, approval,
 * sending, signature per party (fully signed → project created) and termination.
 */
@Component({
  selector: 'app-contract-detail-page',
  imports: [RouterLink, TranslatePipe, StatusBadgeComponent, CompletenessPanelComponent, DetailItemComponent, DocumentsPanelComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './contract-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ContractDetailPage {
  protected readonly api = inject(ContractsApi);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly id = input.required<string>();

  protected readonly data = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get(params) });
  protected readonly contract = computed(() => this.data.value()?.contract);
  protected readonly reload = () => this.data.reload();

  protected readonly form = signal({ contractDate: '', validUntil: '', scope: '', specialTerms: '', notes: '', changeReason: '' });
  protected readonly signatories = signal<Array<{ party: 'customer' | 'company'; name: string; title?: string; email?: string }>>([]);
  protected readonly signature = signal({ party: 'customer' as 'customer' | 'company', signatoryName: '', signatoryTitle: '', signedAt: '' });
  protected readonly terminateReason = signal('');

  protected readonly opportunityId = computed(() => {
    const opp = this.contract()?.opportunityId;
    return typeof opp === 'object' ? opp.id : (opp ?? '');
  });
  protected readonly customerName = computed(() => {
    const customer = this.contract()?.customerId;
    return customer && typeof customer === 'object' ? this.i18n.pick(customer.nameAr, customer.nameEn) : '';
  });

  constructor() {
    effect(() => {
      const c = this.contract();
      if (!c) return;
      this.form.set({ contractDate: (c.contractDate ?? '').slice(0, 10), validUntil: (c.validUntil ?? '').slice(0, 10), scope: c.scope ?? '', specialTerms: c.specialTerms ?? '', notes: c.notes ?? '', changeReason: '' });
      this.signatories.set(c.signatories.map(({ party, name, title, email }) => ({ party, name, title, email })));
      this.signature.update((s) => ({ ...s, party: c.status === 'signed_by_customer' ? 'company' : 'customer' }));
    });
  }

  protected setForm(key: string, value: string): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected setSignatory(index: number, key: string, value: string): void {
    this.signatories.update((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  protected addSignatory(): void {
    this.signatories.update((rows) => [...rows, { party: 'customer', name: '' }]);
  }

  protected removeSignatory(index: number): void {
    this.signatories.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected setSignature(key: string, value: string): void {
    this.signature.update((s) => ({ ...s, [key]: value }));
  }

  protected name(value: Person): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value ?? null);
  }

  protected save(event: Event): void {
    event.preventDefault();
    const f = this.form();
    void this.actions.run(
      this.api.update(this.id(), {
        contractDate: f.contractDate || undefined,
        validUntil: f.validUntil || undefined,
        scope: f.scope,
        specialTerms: f.specialTerms,
        notes: f.notes,
        signatories: this.signatories().filter((s) => s.name.trim()),
        changeReason: f.changeReason.trim() || undefined,
      }),
      'prop.saved',
      this.reload,
    );
  }

  protected sign(event: Event): void {
    event.preventDefault();
    const s = this.signature();
    void this.actions.run(
      this.api.sign(this.id(), { party: s.party, signatoryName: s.signatoryName.trim(), signatoryTitle: s.signatoryTitle.trim() || undefined, signedAt: s.signedAt ? new Date(s.signedAt).toISOString() : undefined }),
      'contracts.signed',
      this.reload,
    );
  }

  protected toggleDocument(code: string, received: boolean): void {
    void this.actions.run(this.api.document(this.id(), { code, received }), null, this.reload);
  }
}

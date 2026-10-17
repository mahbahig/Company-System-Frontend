import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CompletenessPanelComponent } from '../../../shared/crm/completeness-panel/completeness-panel.component';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { userName } from '../../../shared/utils/display-name';
import type { CostLine, FinancingOption, PaymentMilestone, Person } from '../proposals.models';
import { ProposalsApi } from '../proposals-api.service';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';

const COST_CATEGORIES = ['equipment', 'installation', 'engineering', 'transport', 'permits', 'other'];

/**
 * FPROP-01..05 financial proposal: cost lines (prefilled from the BOM),
 * contingency, price, discount (reason mandatory once non-zero), VAT,
 * payment milestones (must total 100%), financing, exchange rates and
 * validity. Totals and margin are computed by the server; margin and cost
 * never reach roles without cost visibility.
 */
@Component({
  selector: 'app-financial-proposal-page',
  imports: [DetailSkeletonComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, CompletenessPanelComponent, DetailItemComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS, CreateIconComponent],
  templateUrl: './financial-proposal.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class FinancialProposalPage {
  protected readonly api = inject(ProposalsApi);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly id = input.required<string>();

  protected readonly categories = COST_CATEGORIES;
  protected readonly data = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.financial(params) });
  protected readonly proposal = computed(() => this.data.value()?.proposal);
  protected readonly canEdit = computed(() => !!this.data.value()?.canEdit);
  protected readonly canSeeCost = computed(() => !!this.data.value()?.canSeeCost);

  protected readonly costLines = signal<CostLine[]>([]);
  protected readonly milestones = signal<PaymentMilestone[]>([]);
  protected readonly financing = signal<FinancingOption[]>([]);
  protected readonly form = signal({ contingencyPct: 0, listPrice: '' as number | '', discountPct: 0, discountReason: '', vatPct: 14, validityDays: 30, commercialTerms: '', specialTerms: '', usd: '' as number | '', eur: '' as number | '' });
  protected readonly milestoneTotal = computed(() => this.milestones().reduce((sum, m) => sum + (Number(m.pct) || 0), 0));
  protected readonly reload = () => this.data.reload();

  constructor() {
    effect(() => {
      const p = this.proposal();
      if (!p) return;
      this.costLines.set((p.costLines ?? []).map((line) => ({ ...line, equipmentId: line.equipmentId ? String(line.equipmentId) : null })));
      this.milestones.set((p.paymentMilestones ?? []).map(({ name, pct, trigger, dueDays }) => ({ name, pct, trigger, dueDays })));
      this.financing.set([...(p.financingOptions ?? [])]);
      this.form.set({
        contingencyPct: p.contingencyPct ?? 0,
        listPrice: p.listPriceManual ? p.listPrice : '',
        discountPct: p.discountPct ?? 0,
        discountReason: p.discountReason ?? '',
        vatPct: p.vatPct ?? 14,
        validityDays: p.validityDays ?? 30,
        commercialTerms: p.commercialTerms ?? '',
        specialTerms: p.specialTerms ?? '',
        usd: p.exchangeRates?.['USD'] ?? '',
        eur: p.exchangeRates?.['EUR'] ?? '',
      });
    });
  }

  protected patch(key: string, raw: string, numeric = true): void {
    this.form.update((f) => ({ ...f, [key]: numeric ? (raw === '' ? '' : Number(raw)) : raw }));
  }

  protected patchLine(index: number, key: keyof CostLine, raw: string): void {
    const numeric = key === 'quantity' || key === 'unitCost';
    this.costLines.update((lines) => lines.map((line, i) => (i === index ? { ...line, [key]: numeric ? Number(raw) : raw } : line)));
  }

  protected addLine(): void {
    this.costLines.update((lines) => [...lines, { category: 'installation', description: '', quantity: 1, unit: 'lot', unitCost: 0, currency: 'EGP' }]);
  }

  protected removeLine(index: number): void {
    this.costLines.update((lines) => lines.filter((_, i) => i !== index));
  }

  protected patchMilestone(index: number, key: keyof PaymentMilestone, raw: string): void {
    const numeric = key === 'pct' || key === 'dueDays';
    this.milestones.update((items) => items.map((item, i) => (i === index ? { ...item, [key]: numeric ? (raw === '' ? undefined : Number(raw)) : raw } : item)));
  }

  protected addMilestone(): void {
    this.milestones.update((items) => [...items, { name: '', pct: 0 }]);
  }

  protected removeMilestone(index: number): void {
    this.milestones.update((items) => items.filter((_, i) => i !== index));
  }

  protected patchFinancing(index: number, key: keyof FinancingOption, raw: string): void {
    const numeric = key === 'termMonths' || key === 'interestPct';
    this.financing.update((items) => items.map((item, i) => (i === index ? { ...item, [key]: numeric ? (raw === '' ? undefined : Number(raw)) : raw } : item)));
  }

  protected addFinancing(): void {
    this.financing.update((items) => [...items, {}]);
  }

  protected removeFinancing(index: number): void {
    this.financing.update((items) => items.filter((_, i) => i !== index));
  }

  protected name(value: Person): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value ?? null);
  }

  protected reasonText(code: string): string {
    const key = `approvals.reasonCodes.${code}`;
    return this.i18n.has(key) ? this.i18n.t(key) : code;
  }

  protected reasons(): string {
    return (this.proposal()?.approvalReasons ?? []).map((code) => this.reasonText(code)).join('، ');
  }

  protected tpLink(): string[] | null {
    const tp = this.proposal()?.technicalProposalId;
    return tp && typeof tp === 'object' ? ['/', 'proposals', 'technical', tp.id] : null;
  }

  protected save(event: Event): void {
    event.preventDefault();
    const f = this.form();
    const rates: Record<string, number> = {};
    if (f.usd !== '') rates['USD'] = Number(f.usd);
    if (f.eur !== '') rates['EUR'] = Number(f.eur);
    void this.actions.run(
      this.api.updateFinancial(this.id(), {
        ...(this.canSeeCost() ? { costLines: this.costLines().filter((line) => line.description.trim()), contingencyPct: f.contingencyPct } : {}),
        ...(f.listPrice !== '' ? { listPrice: Number(f.listPrice) } : {}),
        discountPct: f.discountPct,
        discountReason: f.discountReason || undefined,
        vatPct: f.vatPct,
        validityDays: f.validityDays,
        commercialTerms: f.commercialTerms,
        specialTerms: f.specialTerms,
        paymentMilestones: this.milestones().filter((m) => m.name.trim()),
        financingOptions: this.financing(),
        exchangeRates: rates,
      }),
      'prop.saved',
      this.reload,
    );
  }
}

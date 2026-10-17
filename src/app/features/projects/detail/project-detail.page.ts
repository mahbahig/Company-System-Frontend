import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ProjectWorkflowPanelComponent } from './project-workflow-panel.component';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../core/api/api-error';
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
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { TabsComponent } from '../../../shared/ui/tabs/tabs.component';
import type { TabItem } from '../../../shared/ui/tabs/tab-item.interface';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { userName } from '../../../shared/utils/display-name';
import type { Person } from '../../proposals/proposals.models';
import { ProjectsApi } from '../projects-api.service';
import { LocalPager } from '../../../shared/crm/pagination/local-pager';
import { PagerComponent } from '../../../shared/crm/pagination/pager.component';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';
import { PagerSizeComponent } from '../../../shared/crm/pagination/page-size-select.component';

const PHASES = ['planning', 'procurement', 'installation', 'testing_commissioning', 'customer_acceptance', 'warranty_service'];

/**
 * PROJ-01..10 project: everything inherited from the contract (no re-entry),
 * status walk through the phases, milestones, procurement, payment schedule,
 * delays, customer updates, commissioning tests and handover with customer
 * acceptance.
 */
@Component({
  selector: 'app-project-detail-page',
  imports: [BreadcrumbsComponent, FavoriteToggleComponent, DetailSkeletonComponent, ProjectWorkflowPanelComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, CompletenessPanelComponent, DetailItemComponent, DocumentsPanelComponent, AlertComponent, BadgeComponent, ButtonDirective, PageHeaderComponent, TabsComponent, ...CARD_IMPORTS, ...FORM_IMPORTS, ...TABLE_IMPORTS, PagerComponent, CreateIconComponent, PagerSizeComponent],
  templateUrl: './project-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ProjectDetailPage {
  protected readonly api = inject(ProjectsApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly navigation = inject(NavigationService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly id = input.required<string>();
  readonly tab = input<string>();

  protected readonly phases = PHASES;
  protected readonly data = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get(params) });
  protected readonly project = computed(() => this.data.value()?.project);
  /** The project's payments, paged in memory. */
  protected readonly paymentsPager = new LocalPager(() => this.project()?.payments);
  /** The project's procurement items, paged in memory. */
  protected readonly procurementPager = new LocalPager(() => this.project()?.procurement);
  /** The project's milestones, paged in memory (each row edits its own milestone). */
  protected readonly milestonesPager = new LocalPager(() => this.project()?.milestones);
  protected readonly reload = () => this.data.reload();

  /** Payment milestones only reach roles with financial visibility (the API omits them otherwise). */
  protected readonly tabs = computed<TabItem[]>(() =>
    ['delivery', 'overview', 'plan', 'procurement', 'payments', 'commissioning', 'handover', 'updates', 'documents']
      .filter((id) => id !== 'payments' || this.project()?.payments !== undefined)
      .map((id) => ({ id, label: this.i18n.t(`projects.tabs.${id}`) })),
  );
  protected readonly active = computed(() => (this.tabs().some((t) => t.id === this.tab()) ? (this.tab() as string) : 'delivery'));

  protected readonly plan = signal({ startDate: '', targetEndDate: '', progress: 0 });
  protected readonly milestone = signal({ title: '', phaseCode: 'planning', dueAt: '' });
  protected readonly procurement = signal({ description: '', model: '', quantity: 1, supplier: '', poNumber: '', expectedAt: '' });
  protected readonly delay = signal({ reason: '', days: 7, phaseCode: '' });
  protected readonly update = signal({ channel: 'call', message: '' });
  protected readonly tests = signal<Array<{ test: string; result: string; passed: boolean; notes?: string }>>([]);
  protected readonly commission = signal({ commissionedAt: '', utilityConnectionStatus: 'not_applied', netMeteringStatus: 'not_applicable', notes: '' });
  protected readonly warranties = signal<Array<{ item: string; provider?: string; years: number }>>([]);
  protected readonly handoverForm = signal({ customerAcceptedAt: '', acceptedByName: '', notes: '' });

  protected readonly customerName = computed(() => {
    const c = this.project()?.customerId;
    return c && typeof c === 'object' ? this.i18n.pick(c.nameAr, c.nameEn) : '';
  });
  protected readonly notFound = computed(() => {
    const error = this.data.error();
    return ApiError.is(error) && (error.status === 404 || error.status === 400);
  });
  /** Projects / <customer> / <project>: the customer is context only (its record scope is not the project's). */
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('navigation.items.projects'), path: '/projects' },
    { label: this.customerName() },
    { label: this.project()?.name ?? '' },
  ]);

  constructor() {
    trackRecentView('project', () => this.id(), () => (this.project() ? 'loaded' : this.notFound() ? 'missing' : 'pending'));
    effect(() => {
      const p = this.project();
      if (!p) return;
      this.plan.set({ startDate: (p.startDate ?? '').slice(0, 10), targetEndDate: (p.targetEndDate ?? '').slice(0, 10), progress: p.installationProgressPct });
      this.tests.set(p.commissioning?.testResults?.length ? p.commissioning.testResults.map((t) => ({ ...t })) : DEFAULT_TESTS.map((test) => ({ test, result: '', passed: false })));
      this.commission.set({ commissionedAt: (p.commissioning?.commissionedAt ?? '').slice(0, 10), utilityConnectionStatus: p.commissioning?.utilityConnectionStatus ?? 'not_applied', netMeteringStatus: p.commissioning?.netMeteringStatus ?? 'not_applicable', notes: p.commissioning?.notes ?? '' });
      this.warranties.set(p.handover?.warranties?.length ? p.handover.warranties.map(({ item, provider, years }) => ({ item, provider, years })) : [{ item: 'PV panels', years: 25 }, { item: 'Inverters', years: 10 }, { item: 'Installation workmanship', years: 2 }]);
      this.handoverForm.set({ customerAcceptedAt: (p.handover?.customerAcceptedAt ?? '').slice(0, 10), acceptedByName: p.handover?.acceptedByName ?? '', notes: p.handover?.notes ?? '' });
    });
  }

  protected selectTab(tab: string): void {
    void this.router.navigate([], { queryParams: { tab: tab === 'overview' ? null : tab }, queryParamsHandling: 'merge' });
  }

  protected sub(item: { id?: string; _id?: string }): string {
    return String(item.id ?? item._id ?? '');
  }

  protected name(value: Person): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value ?? null);
  }

  protected ref(value: unknown, key: string): string {
    return value && typeof value === 'object' ? String((value as Record<string, unknown>)[key] ?? '') : '';
  }

  protected patch<T extends object>(target: { update: (fn: (value: T) => T) => void }, key: keyof T, value: unknown): void {
    target.update((current) => ({ ...current, [key]: value }));
  }

  protected iso(date: string): string | undefined {
    return date ? new Date(`${date}T12:00:00`).toISOString() : undefined;
  }

  protected savePlan(): void {
    const p = this.plan();
    void this.actions.run(this.api.update(this.id(), { startDate: this.iso(p.startDate), targetEndDate: this.iso(p.targetEndDate), installationProgressPct: Number(p.progress) }), 'prop.saved', this.reload);
  }

  protected addMilestone(): void {
    const m = this.milestone();
    void this.actions.run(this.api.addMilestone(this.id(), { title: m.title.trim(), phaseCode: m.phaseCode, dueAt: this.iso(m.dueAt) }), 'prop.saved', () => {
      this.milestone.set({ title: '', phaseCode: 'planning', dueAt: '' });
      this.reload();
    });
  }

  protected setMilestoneStatus(milestoneId: string, title: string, status: string): void {
    void this.actions.run(this.api.updateMilestone(this.id(), milestoneId, { title, status }), null, this.reload);
  }

  protected addProcurement(): void {
    const p = this.procurement();
    void this.actions.run(
      this.api.addProcurement(this.id(), { description: p.description.trim(), model: p.model || undefined, quantity: Number(p.quantity), supplier: p.supplier || undefined, poNumber: p.poNumber || undefined, expectedAt: this.iso(p.expectedAt) }),
      'prop.saved',
      () => {
        this.procurement.set({ description: '', model: '', quantity: 1, supplier: '', poNumber: '', expectedAt: '' });
        this.reload();
      },
    );
  }

  protected setProcurementStatus(itemId: string, description: string, quantity: number, status: string): void {
    void this.actions.run(this.api.updateProcurement(this.id(), itemId, { description, quantity, status }), null, this.reload);
  }

  protected setPaymentStatus(paymentId: string, status: string): void {
    const now = new Date().toISOString();
    void this.actions.run(this.api.updatePayment(this.id(), paymentId, { status, ...(status === 'invoiced' ? { invoicedAt: now } : {}), ...(status === 'paid' ? { paidAt: now } : {}) }), null, this.reload);
  }

  protected addDelay(): void {
    const d = this.delay();
    void this.actions.run(this.api.delay(this.id(), { reason: d.reason.trim(), days: Number(d.days), phaseCode: d.phaseCode || undefined }), 'prop.saved', () => {
      this.delay.set({ reason: '', days: 7, phaseCode: '' });
      this.reload();
    });
  }

  protected addUpdate(): void {
    const u = this.update();
    void this.actions.run(this.api.customerUpdate(this.id(), { channel: u.channel, message: u.message.trim() }), 'prop.saved', () => {
      this.update.set({ channel: 'call', message: '' });
      this.reload();
    });
  }

  protected setTest(index: number, key: string, value: unknown): void {
    this.tests.update((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  protected saveCommissioning(): void {
    const c = this.commission();
    void this.actions.run(
      this.api.commissioning(this.id(), { testResults: this.tests().filter((t) => t.test.trim() && t.result.trim()), commissionedAt: this.iso(c.commissionedAt), utilityConnectionStatus: c.utilityConnectionStatus, netMeteringStatus: c.netMeteringStatus, notes: c.notes || undefined }),
      'prop.saved',
      this.reload,
    );
  }

  protected setWarranty(index: number, key: string, value: unknown): void {
    this.warranties.update((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  protected saveHandover(): void {
    const h = this.handoverForm();
    void this.actions.run(
      this.api.handover(this.id(), { warranties: this.warranties().filter((w) => w.item.trim()), customerAcceptedAt: this.iso(h.customerAcceptedAt), acceptedByName: h.acceptedByName || undefined, notes: h.notes || undefined }),
      'prop.saved',
      this.reload,
    );
  }

  protected phaseStatus(code: string): string {
    return this.project()?.phases.find((phase) => phase.code === code)?.status ?? 'pending';
  }
}

const DEFAULT_TESTS = ['Insulation resistance', 'String open-circuit voltage', 'Earthing continuity', 'Inverter start-up & grid sync', 'Protection settings'];

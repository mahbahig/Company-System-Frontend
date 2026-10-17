import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CustomerWorkflowPanelComponent } from './customer-workflow-panel.component';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ExternalLink } from 'lucide';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { ApiService } from '../../../core/api/api.service';
import { DocumentsPanelComponent } from '../../../shared/crm/documents-panel/documents-panel.component';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { StatCardComponent } from '../../../shared/ui/stat-card/stat-card.component';
import { TabsComponent } from '../../../shared/ui/tabs/tabs.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { trackRecentView } from '../../../core/records/track-recent-view';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { FavoriteToggleComponent } from '../../../shared/crm/favorite-toggle/favorite-toggle.component';
import { InlineEditComponent } from '../../../shared/crm/inline-edit/inline-edit.component';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { isValidEmail } from '../../../shared/utils/contact-validation';
import type { Customer360 } from '../models/customer-360.interface';
import { CustomerActivitiesComponent } from './customer-activities.component';
import { CustomerDeliveryComponent } from './customer-delivery.component';
import { CompletenessPanelComponent } from '../../../shared/crm/completeness-panel/completeness-panel.component';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { TimelineComponent } from '../../../shared/crm/timeline/timeline.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CardContentDirective } from '../../../shared/ui/card/card-content.directive';
import { CardHeaderDirective } from '../../../shared/ui/card/card-header.directive';
import { CardTitleDirective } from '../../../shared/ui/card/card-title.directive';
import { CardDirective } from '../../../shared/ui/card/card.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TableBodyDirective } from '../../../shared/ui/table/table-body.directive';
import { TableCellDirective } from '../../../shared/ui/table/table-cell.directive';
import { TableEmptyComponent } from '../../../shared/ui/table/table-empty.component';
import { TableHeadDirective } from '../../../shared/ui/table/table-head.directive';
import { TableHeaderDirective } from '../../../shared/ui/table/table-header.directive';
import { TableRowDirective } from '../../../shared/ui/table/table-row.directive';
import { TableWrapperComponent } from '../../../shared/ui/table/table-wrapper.component';
import { TableDirective } from '../../../shared/ui/table/table.directive';
import { asUserRef } from '../../../shared/utils/display-name';
import { formatPhone } from '../../../shared/utils/format';
import { OpportunitiesApi } from '../../opportunities/opportunities-api.service';
import { StatusPageComponent } from '../../errors/status-page.component';
import { CustomersApi } from '../customers-api.service';
import { SitesApi } from '../sites/sites-api.service';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { RowLinkDirective } from '../../../shared/ui/table/row-link.directive';
import { LocalPager } from '../../../shared/crm/pagination/local-pager';
import { PagerComponent } from '../../../shared/crm/pagination/pager.component';
import { PagerState } from '../../../shared/crm/pagination/local-pager';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';
import { PageSizeSelectComponent, PagerSizeComponent } from '../../../shared/crm/pagination/page-size-select.component';

/**
 * Customer 360 (first slice): details, assignment, completeness, contacts
 * and opportunities. Same anatomy as the Next detail page.
 */
@Component({
  selector: 'app-customer-detail-page',
  imports: [
    RowLinkDirective,
    BreadcrumbsComponent,
    FavoriteToggleComponent,
    InlineEditComponent,
    DetailSkeletonComponent,
    SkeletonRowComponent,
    CustomerWorkflowPanelComponent,
    RouterLink,
    TranslatePipe,
    PageHeaderComponent,
    DetailItemComponent,
    CompletenessPanelComponent,
    TimelineComponent,
    AlertComponent,
    BadgeComponent,
    ButtonDirective,
    IconComponent,
    StatusPageComponent,
    CardDirective,
    CardHeaderDirective,
    CardTitleDirective,
    CardContentDirective,
    TableWrapperComponent,
    TableDirective,
    TableHeaderDirective,
    TableBodyDirective,
    TableRowDirective,
    TableHeadDirective,
    TableCellDirective,
    TableEmptyComponent,
    DocumentsPanelComponent,
    UserSelectComponent,
    DialogComponent,
    StatCardComponent,
    TabsComponent,
    CustomerActivitiesComponent,
    CustomerDeliveryComponent,
    ...FORM_IMPORTS, PagerComponent, PaginationComponent, CreateIconComponent, PageSizeSelectComponent, PagerSizeComponent],
  templateUrl: './customer-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class CustomerDetailPage {
  private readonly customers = inject(CustomersApi);
  private readonly opportunitiesApi = inject(OpportunitiesApi);
  private readonly sitesApi = inject(SitesApi);
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly title = inject(Title);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  /** Route param. */
  readonly id = input.required<string>();

  protected readonly externalIcon = ExternalLink;
  protected readonly formatPhone = formatPhone;

  protected readonly detail = rxResource({ params: () => this.id(), stream: ({ params }) => this.customers.get(params) });
  // Contacts and sites load only for roles that read them (no request the API would refuse).
  protected readonly contacts = rxResource({
    params: () => (this.auth.can('contacts.view') ? this.id() : undefined),
    stream: ({ params }) => this.customers.contacts(params),
  });
  /** The customer's contacts (a handful per customer, loaded with it), paged in memory. */
  protected readonly contactsPager = new LocalPager(() => this.contacts.value());
  protected readonly sites = rxResource({
    params: () => (this.auth.can('sites.view') ? this.id() : undefined),
    stream: ({ params }) => this.sitesApi.list(params),
  });
  /** The customer's sites, paged in memory. */
  protected readonly sitesPager = new LocalPager(() => this.sites.value());
  /** The customer's opportunities: paged by the API (no silent cut-off). */
  protected readonly opportunitiesPager = new PagerState();
  protected readonly opportunities = rxResource({
    params: () => (this.auth.can('opportunities.view') ? { customerId: this.id(), page: this.opportunitiesPager.page(), pageSize: this.opportunitiesPager.pageSize() } : undefined),
    stream: ({ params }) => this.opportunitiesApi.list(params),
  });

  protected readonly customer = computed(() => (this.detail.hasValue() ? this.detail.value().customer : null));
  protected readonly notFound = computed(() => {
    const error = this.detail.error();
    return ApiError.is(error) && (error.status === 404 || error.status === 400);
  });
  protected readonly displayName = computed(() => {
    const customer = this.customer();
    return customer ? this.i18n.pick(customer.nameAr, customer.nameEn) || customer.primaryContactName || '' : '';
  });
  protected readonly ownerName = computed(() => {
    const owner = asUserRef(this.customer()?.ownerId);
    return owner ? this.i18n.pick(owner.fullNameAr, owner.fullNameEn) : this.i18n.t('crm.common.unassigned');
  });
  protected readonly canViewOpportunities = computed(() => this.auth.can('opportunities.view'));
  /** The server's verdict for THIS customer (permission in record scope, not merged) — also gates inline edits. */
  protected readonly canEdit = computed(() => (this.detail.hasValue() ? !!this.detail.value().canEdit : false));
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('navigation.items.customers'), path: '/customers' },
    { label: this.displayName() || (this.customer()?.customerNo ?? '') },
  ]);
  protected readonly saveEmail = (email: string) => this.customers.update(this.id(), { email: email || undefined });
  protected readonly saveFollowUp = (date: string) => this.customers.update(this.id(), { nextFollowUpAt: date || undefined });
  protected readonly emailCheck = (value: string) => (!value ? 'validation.required' : isValidEmail(value) ? null : 'ux.validation.email');
  protected readonly requiredCheck = (value: string) => (value ? null : 'validation.required');
  protected readonly canChangeStatus = computed(() => this.auth.canAny(['customers.edit', 'customers.archive', 'customers.blacklist']));
  protected readonly actions = new ActionRunner(this.i18n);

  /** CUST-03 everything about the customer in one call. */
  protected readonly view360 = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get<Customer360>(`customers/${params}/360`) });

  protected readonly tab = signal('overview');
  protected readonly tabs = computed(() => {
    const v = this.view360.value();
    return [
      { id: 'overview', label: this.i18n.t('customer360.tabs.overview') },
      ...(this.canViewOpportunities() ? [{ id: 'opportunities', label: this.i18n.t('customer360.tabs.opportunities'), count: v ? v.opportunities.length : null }] : []),
      // Sections the role reads nothing from are not offered (the API returns them empty anyway).
      ...(this.auth.canAny(['combined_proposals.view', 'contracts.view', 'projects.view', 'leads.view'])
        ? [{ id: 'delivery', label: this.i18n.t('customer360.tabs.delivery'), count: v ? v.proposals.length + v.contracts.length + v.projects.length : null }]
        : []),
      ...(this.auth.canAny(['activities.view', 'calls.view', 'meetings.view', 'visits.view', 'tasks.view'])
        ? [{ id: 'activities', label: this.i18n.t('customer360.tabs.activities') }]
        : []),
      ...(this.auth.can('files.view') ? [{ id: 'documents', label: this.i18n.t('customer360.tabs.documents'), count: v ? v.summary.documents : null }] : []),
      { id: 'timeline', label: this.i18n.t('customer360.tabs.timeline') },
    ];
  });

  protected readonly statusOpen = signal(false);
  protected readonly ownerOpen = signal(false);
  protected readonly newStatus = signal('active');
  protected readonly statusReason = signal('');
  protected readonly newOwner = signal('');
  protected readonly ownerReason = signal('');
  protected readonly manualStatuses = computed(() => {
    const list: string[] = [];
    if (this.auth.can('customers.edit')) list.push('prospect', 'active', 'inactive');
    if (this.auth.can('customers.blacklist')) list.push('blacklisted');
    if (this.auth.can('customers.archive')) list.push('archived');
    return list;
  });
  protected readonly reasonRequired = computed(() => ['inactive', 'blacklisted', 'archived'].includes(this.newStatus()));

  protected saveStatus(event: Event): void {
    event.preventDefault();
    void this.actions.run(this.api.post(`customers/${this.id()}/status`, { status: this.newStatus(), reason: this.statusReason().trim() || undefined }), 'customer360.statusChanged', () => {
      this.statusOpen.set(false);
      this.statusReason.set('');
      this.detail.reload();
    });
  }

  protected saveOwner(event: Event): void {
    event.preventDefault();
    void this.actions.run(this.api.post(`customers/${this.id()}/owner`, { ownerId: this.newOwner(), reason: this.ownerReason().trim() }), 'customer360.ownerChanged', () => {
      this.ownerOpen.set(false);
      this.ownerReason.set('');
      this.detail.reload();
      this.view360.reload();
    });
  }

  constructor() {
    void this.reference.load();
    trackRecentView('customer', () => this.id(), () => (this.customer() ? 'loaded' : this.notFound() ? 'missing' : 'pending'));
    // "<name> · <number> · Ecotech", like the Next page metadata.
    effect(() => {
      const customer = this.customer();
      if (customer) this.title.setTitle(`${this.displayName()} · ${customer.customerNo} · ${this.i18n.t('app.name')}`);
    });
  }

  protected customerName(ref: { nameAr?: string; nameEn?: string; primaryContactName?: string } | string): string {
    return typeof ref === 'string' ? '' : this.i18n.pick(ref.nameAr, ref.nameEn) || ref.primaryContactName || '';
  }

  protected userName(ref: Parameters<typeof asUserRef>[0]): string {
    const user = asUserRef(ref);
    return user ? this.i18n.pick(user.fullNameAr, user.fullNameEn) : this.i18n.t('crm.common.unassigned');
  }
}

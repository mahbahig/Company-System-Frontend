import { Component, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, form, maxLength, min, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { Search } from 'lucide';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { FormDraft } from '../../../core/forms/form-draft';
import { UnsavedChanges, type HasUnsavedChanges } from '../../../core/forms/unsaved-changes';
import { SaveShortcutDirective } from '../../../core/shortcuts/save-shortcut.directive';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { DraftBannerComponent } from '../../../shared/crm/draft-banner/draft-banner.component';
import { focusFirstInvalid } from '../../../shared/utils/focus-invalid';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CardContentDirective } from '../../../shared/ui/card/card-content.directive';
import { CardHeaderDirective } from '../../../shared/ui/card/card-header.directive';
import { CardTitleDirective } from '../../../shared/ui/card/card-title.directive';
import { CardDirective } from '../../../shared/ui/card/card.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { SelectDirective } from '../../../shared/ui/form/select.directive';
import { TextareaDirective } from '../../../shared/ui/form/textarea.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { asUserRef } from '../../../shared/utils/display-name';
import { CustomersApi } from '../../customers/customers-api.service';
import type { DuplicateMatch } from '../models/duplicate-match.interface';
import type { CreateOpportunityPayload } from '../models/create-opportunity-payload.interface';
import type { OpportunityFields } from '../models/opportunity-fields.interface';
import { OpportunitiesApi } from '../opportunities-api.service';
import { SitesLookupApi } from '../sites-lookup-api.service';
import { UsersLookupApi } from '../users-lookup-api.service';
import { EMPTY_OPPORTUNITY_FORM, type OpportunityFormModel } from './opportunity-form-model.interface';

/** Enough of a customer to show in the picker/summary — a full `Customer` or an embedded `CustomerRef`. */
type CustomerOption = { id: string; customerNo: string; nameAr?: string; nameEn?: string; primaryContactName?: string };

/** Create/edit an opportunity (OPP-01). Customer and site are picked by search; everything else is a plain field. */
@Component({
  selector: 'app-opportunity-form-page',
  imports: [
    FormField,
    RouterLink,
    SaveShortcutDirective,
    BreadcrumbsComponent,
    DraftBannerComponent,
    TranslatePipe,
    PageHeaderComponent,
    AlertComponent,
    BadgeComponent,
    ButtonDirective,
    CardDirective,
    CardHeaderDirective,
    CardTitleDirective,
    CardContentDirective,
    InputDirective,
    LabelComponent,
    SelectComponent,
    SelectDirective,
    TextareaDirective,
    IconComponent,
  ],
  templateUrl: './opportunity-form.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class OpportunityFormPage implements HasUnsavedChanges {
  private readonly opportunitiesApi = inject(OpportunitiesApi);
  private readonly customersApi = inject(CustomersApi);
  private readonly sitesApi = inject(SitesLookupApi);
  private readonly usersApi = inject(UsersLookupApi);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  /** Route param; present only on the edit route. */
  readonly id = input<string>();
  /** `?customerId=` from a customer page's "New opportunity": prefills the customer (create only). */
  readonly customerId = input<string>();

  protected readonly searchIcon = Search;
  protected readonly isEdit = computed(() => !!this.id());
  protected readonly canAssign = computed(() => this.auth.can('opportunities.assign'));

  protected readonly serverError = signal<string | null>(null);
  protected readonly serverFieldErrors = signal<Record<string, string>>({});
  protected readonly duplicateMatches = signal<DuplicateMatch[] | null>(null);

  private readonly model = signal<OpportunityFormModel>({ ...EMPTY_OPPORTUNITY_FORM });

  // Customer search (create only — the customer is fixed once an opportunity exists).
  protected readonly customerQuery = signal('');
  protected readonly selectedCustomer = signal<CustomerOption | null>(null);
  private readonly customerSearch = rxResource({
    params: () => (this.customerQuery().trim().length >= 2 ? this.customerQuery().trim() : undefined),
    stream: ({ params }) => this.customersApi.list({ q: params, pageSize: 8 }),
  });
  protected readonly customerResults = computed(() => this.customerSearch.value()?.rows ?? []);

  protected readonly contacts = rxResource({
    params: () => this.model().customerId || undefined,
    stream: ({ params }) => this.customersApi.contacts(params),
  });
  protected readonly sites = rxResource({
    params: () => this.model().customerId || undefined,
    stream: ({ params }) => this.sitesApi.forCustomer(params),
  });
  protected readonly owners = rxResource({
    params: () => (this.canAssign() ? '' : undefined),
    stream: () => this.usersApi.lookup(),
  });

  protected readonly existing = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.opportunitiesApi.get(params),
  });

  protected readonly opportunityForm = form(this.model, (path) => {
    required(path.name, { message: 'validation.required' });
    maxLength(path.name, 200, { message: 'validation.tooLong' });
    required(path.customerId, { message: 'validation.required' });
    required(path.solutionTypeCode, { message: 'validation.required' });
    min(path.estimatedValue, 0, { message: 'validation.mustBePositive' });
    min(path.estimatedKwp, 0, { message: 'validation.mustBePositive' });
    min(path.storageKwh, 0, { message: 'validation.mustBePositive' });
    maxLength(path.nextAction, 300, { message: 'validation.tooLong' });
    maxLength(path.notes, 4000, { message: 'validation.tooLong' });
  });

  /** Unsent input of a NEW opportunity, kept in this browser only. */
  protected readonly draft = new FormDraft<{ model: OpportunityFormModel; customer: CustomerOption | null }>(
    'opportunity.new',
    computed(() => ({ model: this.model(), customer: this.selectedCustomer() })),
    { enabled: () => !this.isEdit(), dirty: () => this.opportunityForm().dirty() },
  );
  private saved = false;
  protected readonly crumbs = computed(() => {
    const existing = this.existing.value()?.opportunity;
    return [
      { label: this.i18n.t('navigation.items.opportunities'), path: '/opportunities' },
      ...(existing ? [{ label: existing.name, path: `/opportunities/${existing.id}` }] : []),
      { label: this.i18n.t(this.isEdit() ? 'crm.opportunities.editTitle' : 'crm.opportunities.newTitle') },
    ];
  });

  hasUnsavedChanges(): boolean {
    return !this.saved && this.opportunityForm().dirty();
  }

  protected restoreDraft(): void {
    this.draft.restore((value) => {
      this.model.set({ ...EMPTY_OPPORTUNITY_FORM, ...value.model });
      this.selectedCustomer.set(value.customer);
    });
  }

  constructor() {
    void this.reference.load();
    inject(UnsavedChanges).track(() => this.hasUnsavedChanges());
    // Smart default: a "New opportunity" started from a customer page arrives with that customer.
    // It is read through the scoped API, so only a customer this user can open is prefilled.
    effect(() => {
      const customerId = this.customerId();
      if (!customerId || this.isEdit()) return;
      untracked(() => {
        if (this.model().customerId) return;
        void firstValueFrom(this.customersApi.get(customerId))
          .then(({ customer }) => {
            if (!this.model().customerId) this.pickCustomer(customer);
          })
          .catch(() => undefined);
      });
    });
    // Populate the form once the existing opportunity loads (edit route only).
    effect(() => {
      const detail = this.existing.value();
      if (!detail) return;
      const opportunity = detail.opportunity;
      const customer = opportunity.customerId;
      if (typeof customer !== 'string') this.selectedCustomer.set(customer);
      this.model.set({
        name: opportunity.name,
        customerId: typeof customer === 'string' ? customer : customer.id,
        primaryContactId: typeof opportunity.primaryContactId === 'string' ? opportunity.primaryContactId : (opportunity.primaryContactId?.id ?? ''),
        siteId: typeof opportunity.siteId === 'string' ? opportunity.siteId : (opportunity.siteId?.id ?? ''),
        solutionTypeCode: opportunity.solutionTypeCode ?? '',
        serviceTypeCode: opportunity.serviceTypeCode ?? '',
        estimatedValue: opportunity.estimatedValue ?? null,
        estimatedKwp: opportunity.estimatedKwp ?? null,
        storageKwh: opportunity.storageKwh ?? null,
        expectedCloseDate: opportunity.expectedCloseDate?.slice(0, 10) ?? '',
        priority: opportunity.priority ?? '',
        leadSourceCode: opportunity.leadSourceCode ?? '',
        campaignCode: opportunity.campaignCode ?? '',
        nextAction: opportunity.nextAction ?? '',
        nextActionAt: opportunity.nextActionAt?.slice(0, 10) ?? '',
        notes: opportunity.notes ?? '',
        ownerId: '',
      });
    });
  }

  protected fieldError(field: keyof OpportunityFormModel): string | null {
    const state = this.opportunityForm[field]();
    const server = this.serverFieldErrors()[field as string];
    if (server) return server;
    return state.touched() ? (state.errors()[0]?.message ?? null) : null;
  }

  protected pickCustomer(customer: CustomerOption): void {
    this.selectedCustomer.set(customer);
    this.customerQuery.set('');
    this.model.update((current) => ({ ...current, customerId: customer.id, primaryContactId: '', siteId: '' }));
  }

  protected clearCustomer(): void {
    this.selectedCustomer.set(null);
    this.model.update((current) => ({ ...current, customerId: '', primaryContactId: '', siteId: '' }));
  }

  protected customerLabel(customer: CustomerOption): string {
    return this.i18n.pick(customer.nameAr, customer.nameEn) || customer.primaryContactName || customer.customerNo;
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.opportunityForm().submitting()) return;
    this.serverError.set(null);
    this.serverFieldErrors.set({});
    this.opportunityForm().markAsTouched();
    if (this.opportunityForm().invalid()) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    await submit(this.opportunityForm, async () => {
      await this.save(false);
      return undefined;
    });
  }

  protected async confirmDuplicate(): Promise<void> {
    await this.save(true);
  }

  private async save(confirmDuplicate: boolean): Promise<void> {
    this.duplicateMatches.set(null);
    const value = this.model();
    const fields = this.toFields(value);
    const id = this.id();

    try {
      const saved = id
        ? await firstValueFrom(this.opportunitiesApi.update(id, fields))
        : await firstValueFrom(
            this.opportunitiesApi.create({ ...fields, customerId: value.customerId, ownerId: value.ownerId || undefined, confirmDuplicate } as CreateOpportunityPayload),
          );
      this.saved = true;
      this.draft.clear();
      await this.router.navigateByUrl(`/${this.i18n.locale()}/opportunities/${saved.id}`);
    } catch (error: unknown) {
      if (ApiError.is(error)) {
        const matches = (error.details as { matches?: DuplicateMatch[] } | undefined)?.matches;
        if (error.status === 409 && Array.isArray(matches)) {
          this.duplicateMatches.set(matches);
          return;
        }
        this.serverFieldErrors.set(error.fieldErrors);
        this.serverError.set(this.i18n.has(error.messageKey) ? error.messageKey : 'errors.unexpected');
        if (Object.keys(error.fieldErrors).length) focusFirstInvalid(this.host.nativeElement);
      } else {
        this.serverError.set('errors.unexpected');
      }
    }
  }

  private toFields(value: OpportunityFormModel): OpportunityFields {
    return {
      name: value.name.trim(),
      customerId: value.customerId,
      primaryContactId: value.primaryContactId || undefined,
      siteId: value.siteId || undefined,
      solutionTypeCode: value.solutionTypeCode,
      serviceTypeCode: value.serviceTypeCode || undefined,
      estimatedValue: value.estimatedValue ?? undefined,
      estimatedKwp: value.estimatedKwp ?? undefined,
      storageKwh: value.storageKwh ?? undefined,
      expectedCloseDate: value.expectedCloseDate || undefined,
      priority: value.priority || undefined,
      nextAction: value.nextAction.trim() || undefined,
      nextActionAt: value.nextActionAt || undefined,
      leadSourceCode: value.leadSourceCode || undefined,
      campaignCode: value.campaignCode || undefined,
      notes: value.notes.trim() || undefined,
    };
  }

  protected ownerName(ref: DuplicateMatch['ownerId']): string {
    const owner = asUserRef(ref);
    return owner ? this.i18n.pick(owner.fullNameAr, owner.fullNameEn) : this.i18n.t('crm.common.unassigned');
  }
}

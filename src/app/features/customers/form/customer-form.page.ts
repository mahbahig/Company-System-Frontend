import { Component, ElementRef, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { FormDraft } from '../../../core/forms/form-draft';
import { UnsavedChanges, type HasUnsavedChanges } from '../../../core/forms/unsaved-changes';
import { SaveShortcutDirective } from '../../../core/shortcuts/save-shortcut.directive';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { DraftBannerComponent } from '../../../shared/crm/draft-banner/draft-banner.component';
import { isValidEmail, isValidMobile, isValidPhone } from '../../../shared/utils/contact-validation';
import { focusFirstInvalid } from '../../../shared/utils/focus-invalid';
import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { CustomersApi } from '../customers-api.service';
import type { Customer } from '../models/customer.interface';

interface DuplicateMatch {
  customerId: string;
  customerNo: string;
  nameAr?: string;
  nameEn?: string;
  primaryContactName?: string;
  ownerNameAr?: string;
  ownerNameEn?: string;
  score: number;
  canAccess: boolean;
}

type Model = Record<
  | 'kind'
  | 'nameAr'
  | 'nameEn'
  | 'primaryContactName'
  | 'categoryCode'
  | 'customerTypeCode'
  | 'sectorCode'
  | 'governorateCode'
  | 'cityCode'
  | 'addressLine'
  | 'googleMapsUrl'
  | 'latitude'
  | 'longitude'
  | 'mobile'
  | 'landline'
  | 'whatsappNumber'
  | 'email'
  | 'website'
  | 'taxRegistrationNo'
  | 'commercialRegistrationNo'
  | 'billingEntity'
  | 'billingAddress'
  | 'leadSourceCode'
  | 'campaignCode'
  | 'ownerId'
  | 'notes'
  | 'nextFollowUpAt',
  string
>;

const EMPTY: Model = {
  kind: 'company',
  nameAr: '',
  nameEn: '',
  primaryContactName: '',
  categoryCode: '',
  customerTypeCode: '',
  sectorCode: '',
  governorateCode: '',
  cityCode: '',
  addressLine: '',
  googleMapsUrl: '',
  latitude: '',
  longitude: '',
  mobile: '',
  landline: '',
  whatsappNumber: '',
  email: '',
  website: '',
  taxRegistrationNo: '',
  commercialRegistrationNo: '',
  billingEntity: '',
  billingAddress: '',
  leadSourceCode: '',
  campaignCode: '',
  ownerId: '',
  notes: '',
  nextFollowUpAt: '',
};

/**
 * CUST-01/02 create / edit a customer. Before creating, possible duplicates
 * (name, phone, e-mail, tax / commercial registration) are shown with their
 * owner; the user opens the existing record, requests collaboration or
 * transfer (OWN-04), or explicitly keeps a separate record (DUP-04).
 */
@Component({
  selector: 'app-customer-form-page',
  imports: [RouterLink, TranslatePipe, SaveShortcutDirective, BreadcrumbsComponent, DraftBannerComponent, UserSelectComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './customer-form.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class CustomerFormPage implements HasUnsavedChanges {
  private readonly customers = inject(CustomersApi);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly auth = inject(AuthService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);

  /** Route param on `/customers/:id/edit`. */
  readonly id = input<string>();

  protected readonly m = signal<Model>({ ...EMPTY });
  /** The values as loaded (or empty), to tell real edits from untouched fields. */
  private readonly baseline = signal<Model>({ ...EMPTY });
  /** Client checks are shown after the first save attempt; server field errors until the field changes. */
  private readonly attempted = signal(false);
  private readonly serverErrors = signal<Record<string, { key: string; value: string }>>({});
  /** The server's verdict for an existing customer (edit permission within scope, not merged). */
  protected readonly locked = signal(false);
  private saved = false;
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('navigation.items.customers'), path: '/customers' },
    ...(this.id() ? [{ label: this.i18n.pick(this.baseline().nameAr, this.baseline().nameEn) || this.baseline().primaryContactName, path: `/customers/${this.id()}` }] : []),
    { label: this.i18n.t(this.id() ? 'crm.customers.editTitle' : 'crm.customers.newTitle') },
  ]);
  protected readonly dirty = computed(() => JSON.stringify(this.m()) !== JSON.stringify(this.baseline()));
  /** Unsent input of a NEW customer, kept in this browser only. */
  protected readonly draft = new FormDraft<Model>('customer.new', this.m, { enabled: () => !this.id(), dirty: () => this.dirty() });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly duplicates = signal<DuplicateMatch[] | null>(null);
  protected readonly requestReason = signal('');
  protected readonly requestNote = signal<string | null>(null);
  protected readonly round = Math.round;

  protected readonly selects = [
    { key: 'categoryCode' as const, label: 'crm.customers.fields.categoryCode', type: 'customer_category' as const },
    { key: 'customerTypeCode' as const, label: 'crm.customers.fields.customerTypeCode', type: 'customer_type' as const },
    { key: 'sectorCode' as const, label: 'crm.customers.fields.businessActivityCode', type: 'sector' as const },
  ];

  protected readonly cities = computed(() => {
    const gov = this.m().governorateCode;
    return this.reference
      .items('city')
      .filter((item) => !gov || !item.parentCode || item.parentCode === gov)
      .map((item) => ({ value: item.code, label: this.i18n.pick(item.nameAr, item.nameEn) }));
  });

  /** What the API would reject, as `field → i18n key` (same rules as `CreateCustomerDto`). */
  private readonly clientErrors = computed<Record<string, string>>(() => {
    const m = this.m();
    const errors: Record<string, string> = {};
    if (m.kind === 'company' && !m.nameAr.trim() && !m.nameEn.trim()) errors['nameAr'] = 'validation.required';
    if (m.kind === 'individual' && !m.primaryContactName.trim()) errors['primaryContactName'] = 'validation.required';
    if (!m.mobile.trim() && !m.landline.trim()) errors['mobile'] = 'validation.phoneRequired';
    if (!isValidMobile(m.mobile)) errors['mobile'] = 'ux.validation.mobile';
    if (!isValidPhone(m.landline)) errors['landline'] = 'ux.validation.phone';
    if (!isValidPhone(m.whatsappNumber)) errors['whatsappNumber'] = 'ux.validation.phone';
    if (!isValidEmail(m.email)) errors['email'] = 'ux.validation.email';
    for (const key of ['website', 'googleMapsUrl'] as const) if (m[key].trim() && !/^https?:\/\/\S+$/i.test(m[key].trim())) errors[key] = 'validation.urlInvalid';
    for (const key of ['taxRegistrationNo', 'commercialRegistrationNo'] as const) if (m[key].trim() && !/^[0-9٠-٩۰-۹-]{6,25}$/.test(m[key].trim())) errors[key] = 'validation.registrationInvalid';
    if (!!m.latitude !== !!m.longitude) errors['longitude'] = 'validation.coordinatesPaired';
    return errors;
  });

  /** The message to show under a field, if any. */
  protected problem(field: string): string | null {
    const server = this.serverErrors()[field];
    if (server && server.value === String(this.m()[field as keyof Model] ?? '')) return server.key;
    return this.attempted() ? (this.clientErrors()[field] ?? null) : null;
  }

  hasUnsavedChanges(): boolean {
    return !this.saved && !this.locked() && this.dirty();
  }

  protected restoreDraft(): void {
    this.draft.restore((value) => this.m.set({ ...EMPTY, ...value }));
  }

  constructor() {
    void this.reference.load();
    inject(UnsavedChanges).track(() => this.hasUnsavedChanges());
    effect(() => {
      const id = this.id();
      if (id) void this.loadExisting(id);
    });
  }

  private async loadExisting(id: string): Promise<void> {
    try {
      const { customer, canEdit } = await firstValueFrom(this.customers.get(id));
      const model = this.toModel(customer as Customer & Record<string, unknown>);
      this.locked.set(canEdit === false);
      this.baseline.set(model);
      this.m.set(model);
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
    }
  }

  private toModel(c: Customer & Record<string, unknown>): Model {
    const text = (key: string) => (c[key] === undefined || c[key] === null ? '' : String(c[key]));
    const model = { ...EMPTY };
    for (const key of Object.keys(EMPTY) as (keyof Model)[]) model[key] = text(key);
    model.kind = c.kind;
    model.nextFollowUpAt = c.nextFollowUpAt ? c.nextFollowUpAt.slice(0, 16) : '';
    return model;
  }

  protected set(key: keyof Model, value: string): void {
    this.m.update((m) => ({ ...m, [key]: value }));
  }

  protected canAccessAny(matches: DuplicateMatch[]): boolean {
    return matches.some((match) => match.canAccess);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.attempted.set(true);
    if (Object.keys(this.clientErrors()).length) {
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    void this.save(false);
  }

  protected async save(confirmDuplicate: boolean): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.serverErrors.set({});
    this.error.set(null);
    const body = this.body();
    try {
      const id = this.id();
      // DUP-01: probe before creating; any possible match is shown for a decision (DUP-04).
      if (!id && !confirmDuplicate) {
        const m = this.m();
        const probe = {
          names: [m.nameAr, m.nameEn, m.primaryContactName].map((v) => v.trim()).filter(Boolean),
          phones: [m.mobile, m.landline, m.whatsappNumber].map((v) => v.trim()).filter(Boolean),
          emails: [m.email.trim()].filter(Boolean),
          taxRegistrationNo: m.taxRegistrationNo.trim() || undefined,
          commercialRegistrationNo: m.commercialRegistrationNo.trim() || undefined,
          governorateCode: m.governorateCode || undefined,
        };
        const { matches } = await firstValueFrom(this.api.post<{ matches: DuplicateMatch[] }>('customers/check-duplicates', probe));
        if (matches.length) {
          this.showDuplicates(matches);
          return;
        }
      }
      const result = id
        ? await firstValueFrom(this.api.patch<{ customer?: Customer; id?: string }>(`customers/${id}`, body))
        : await firstValueFrom(this.api.post<{ customer?: Customer; id?: string }>('customers', { ...body, confirmDuplicate: confirmDuplicate || undefined }));
      const savedId = id ?? result.customer?.id ?? result.id;
      this.saved = true;
      this.draft.clear();
      await this.router.navigate(['/', this.i18n.locale(), 'customers', savedId]);
    } catch (error) {
      if (ApiError.is(error) && error.status === 409 && error.messageKey === 'errors.possibleDuplicates') {
        const details = error.details as { matches?: DuplicateMatch[] } | undefined;
        this.showDuplicates(details?.matches ?? []);
      } else {
        this.error.set(this.i18n.errorText(error));
        if (ApiError.is(error) && Object.keys(error.fieldErrors).length) {
          const m = this.m();
          this.serverErrors.set(Object.fromEntries(Object.entries(error.fieldErrors).map(([field, key]) => [field, { key, value: String(m[field as keyof Model] ?? '') }])));
          focusFirstInvalid(this.host.nativeElement);
        }
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Shows the possible duplicates and moves focus to them (the main pane, not the window, is the scroll container). */
  private showDuplicates(matches: DuplicateMatch[]): void {
    this.duplicates.set(matches);
    setTimeout(() => {
      const section = this.host.nativeElement.querySelector<HTMLElement>('section[tabindex="-1"]');
      section?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      section?.focus({ preventScroll: true });
    });
  }

  protected async requestAccess(match: DuplicateMatch, type: 'collaboration' | 'transfer'): Promise<void> {
    const reason = this.requestReason().trim() || this.i18n.t('customerForm.defaultReason');
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.post('ownership/requests', { type, customerId: match.customerId, reason, source: 'customer' }));
      this.requestNote.set(this.i18n.t('customerForm.requestSent'));
    } catch (error) {
      this.error.set(this.i18n.errorText(error));
    } finally {
      this.busy.set(false);
    }
  }

  private body(): Record<string, unknown> {
    const m = this.m();
    const out: Record<string, unknown> = {};
    const editing = !!this.id();
    for (const [key, raw] of Object.entries(m)) {
      if (key === 'ownerId' && editing) continue;
      if (key === 'kind' && editing) continue;
      const value = raw.trim();
      if (!value) continue;
      if (key === 'latitude' || key === 'longitude') out[key] = Number(value);
      else if (key === 'nextFollowUpAt') out[key] = new Date(value).toISOString();
      else out[key] = value;
    }
    if (m.kind === 'individual') {
      delete out['nameAr'];
      delete out['nameEn'];
    }
    return out;
  }
}

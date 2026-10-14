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
  template: `
    <app-breadcrumbs [items]="crumbs()" />
    <app-page-header [heading]="(id() ? 'crm.customers.editTitle' : 'crm.customers.newTitle') | t" class="!mb-0" />
    @if (error(); as text) {
      <app-alert variant="destructive">{{ text }}</app-alert>
    }

    @if (duplicates(); as matches) {
      <section tabindex="-1" appCard class="border-warning focus:outline-none" aria-labelledby="dup-title" role="alert">
        <div appCardHeader>
          <h2 appCardTitle id="dup-title">{{ 'crm.customers.duplicates.title' | t }}</h2>
          <p appCardDescription>{{ 'crm.customers.duplicates.body' | t }}</p>
        </div>
        <div appCardContent class="flex flex-col gap-3">
          @for (match of matches; track match.customerId) {
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
              <div>
                <p class="font-medium">{{ i18n.pick(match.nameAr, match.nameEn) || match.primaryContactName }} <span class="tabular text-xs text-muted-foreground" dir="ltr">{{ match.customerNo }}</span></p>
                <p class="text-xs text-muted-foreground">
                  {{ 'crm.customers.duplicates.score' | t: { score: round(match.score * 100) } }} · {{ 'crm.common.owner' | t }}: {{ i18n.pick(match.ownerNameAr, match.ownerNameEn) || ('crm.common.unassigned' | t) }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                @if (match.canAccess) {
                  <a appButton variant="outline" size="sm" [routerLink]="['/', i18n.locale(), 'customers', match.customerId]">{{ 'customerForm.openExisting' | t }}</a>
                } @else if (auth.can('ownership.request')) {
                  <button type="button" appButton variant="outline" size="sm" [disabled]="busy()" (click)="requestAccess(match, 'collaboration')">{{ 'customerForm.requestCollaboration' | t }}</button>
                  <button type="button" appButton variant="ghost" size="sm" [disabled]="busy()" (click)="requestAccess(match, 'transfer')">{{ 'customerForm.requestTransfer' | t }}</button>
                }
              </div>
            </div>
          }
          @if (requestNote(); as note) {
            <app-alert>{{ note }}</app-alert>
          }
          <div class="flex flex-wrap items-end gap-2">
            @if (!canAccessAny(matches) && auth.can('ownership.request')) {
              <div class="min-w-64 flex-1">
                <label appLabel for="dup-reason">{{ 'customerForm.requestReason' | t }}</label>
                <input appInput id="dup-reason" [value]="requestReason()" (input)="requestReason.set($any($event.target).value)" />
              </div>
            }
            <button type="button" appButton variant="destructive" [disabled]="busy()" (click)="save(true)">{{ 'customerForm.keepSeparate' | t }}</button>
            <button type="button" appButton variant="ghost" (click)="duplicates.set(null)">{{ 'crm.common.cancel' | t }}</button>
          </div>
        </div>
      </section>
    }

    @if (locked()) {
      <app-alert variant="info">{{ 'ux.forms.notEditable' | t }}</app-alert>
    } @else {
    <form class="flex flex-col gap-6" appSaveShortcut (submit)="onSubmit($event)" novalidate>
      <app-draft-banner [offeredAt]="draft.offered()?.savedAt ?? null" [savedAt]="draft.savedAt()" (restore)="restoreDraft()" (discard)="draft.discard()" />
      <p class="text-sm text-muted-foreground">{{ 'ux.forms.requiredHint' | t }}</p>
      <section appCard aria-labelledby="cf-identity">
        <div appCardHeader><h2 appCardTitle id="cf-identity">{{ 'crm.customers.sections.identity' | t }}</h2></div>
        <div appCardContent class="grid gap-4 sm:grid-cols-2">
          <div>
            <label appLabel for="cf-kind" required>{{ 'customerForm.kind' | t }}</label>
            <app-select>
              <select appSelect id="cf-kind" [value]="m().kind" [disabled]="!!id()" (change)="set('kind', $any($event.target).value)">
                <option value="company">{{ 'customerForm.kinds.company' | t }}</option>
                <option value="individual">{{ 'customerForm.kinds.individual' | t }}</option>
              </select>
            </app-select>
          </div>
          <div>
            <label appLabel for="cf-contact" [required]="m().kind === 'individual'">{{ 'crm.customers.fields.primaryContactName' | t }}</label>
            <input appInput id="cf-contact" autocomplete="name" [value]="m().primaryContactName" (input)="set('primaryContactName', $any($event.target).value)" [attr.aria-invalid]="problem('primaryContactName') ? true : null" [attr.aria-describedby]="problem('primaryContactName') ? 'cf-contact-error' : null" />
            @if (problem('primaryContactName'); as key) {
              <p id="cf-contact-error" class="mt-1 text-sm text-destructive">{{ key | t }}</p>
            }
          </div>
          @if (m().kind === 'company') {
            <div>
              <label appLabel for="cf-name-ar" required>{{ 'customerForm.nameAr' | t }}</label>
              <input appInput id="cf-name-ar" dir="rtl" autocomplete="organization" [value]="m().nameAr" (input)="set('nameAr', $any($event.target).value)" [attr.aria-invalid]="problem('nameAr') ? true : null" [attr.aria-describedby]="problem('nameAr') ? 'cf-name-ar-error' : null" />
              @if (problem('nameAr'); as key) {
                <p id="cf-name-ar-error" class="mt-1 text-sm text-destructive">{{ key | t }}</p>
              }
            </div>
            <div>
              <label appLabel for="cf-name-en">{{ 'customerForm.nameEn' | t }}</label>
              <input appInput id="cf-name-en" dir="ltr" [value]="m().nameEn" (input)="set('nameEn', $any($event.target).value)" />
            </div>
          }
        </div>
      </section>

      <section appCard aria-labelledby="cf-class">
        <div appCardHeader><h2 appCardTitle id="cf-class">{{ 'crm.customers.sections.classification' | t }}</h2></div>
        <div appCardContent class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (field of selects; track field.key) {
            <div>
              <label appLabel [for]="'cf-' + field.key">{{ field.label | t }}</label>
              <app-select>
                <select appSelect [id]="'cf-' + field.key" [value]="m()[field.key]" (change)="set(field.key, $any($event.target).value)">
                  <option value="">—</option>
                  @for (option of reference.options(field.type); track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </app-select>
            </div>
          }
        </div>
      </section>

      <section appCard aria-labelledby="cf-contactinfo">
        <div appCardHeader><h2 appCardTitle id="cf-contactinfo">{{ 'crm.customers.sections.contact' | t }}</h2></div>
        <div appCardContent class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label appLabel for="cf-mobile" required>{{ 'crm.customers.fields.mobile' | t }}</label>
            <input appInput id="cf-mobile" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="01012345678" [value]="m().mobile" (input)="set('mobile', $any($event.target).value)" [attr.aria-invalid]="problem('mobile') ? true : null" [attr.aria-describedby]="problem('mobile') ? 'cf-mobile-error' : 'cf-mobile-hint'" />
            @if (problem('mobile'); as key) {
              <p id="cf-mobile-error" class="mt-1 text-sm text-destructive">{{ key | t }}</p>
            } @else {
              <p id="cf-mobile-hint" class="mt-1 text-xs text-muted-foreground">{{ 'crm.customers.hints.mobile' | t }}</p>
            }
          </div>
          <div>
            <label appLabel for="cf-landline">{{ 'crm.customers.fields.landline' | t }}</label>
            <input appInput id="cf-landline" type="tel" inputmode="tel" dir="ltr" placeholder="0223456789" [value]="m().landline" (input)="set('landline', $any($event.target).value)" [attr.aria-invalid]="problem('landline') ? true : null" [attr.aria-describedby]="problem('landline') ? 'cf-landline-error' : null" />
            @if (problem('landline'); as key) {
              <p id="cf-landline-error" class="mt-1 text-sm text-destructive">{{ key | t }}</p>
            }
          </div>
          <div>
            <label appLabel for="cf-wa">{{ 'crm.customers.fields.whatsappNumber' | t }}</label>
            <input appInput id="cf-wa" type="tel" inputmode="tel" dir="ltr" placeholder="01012345678" [value]="m().whatsappNumber" (input)="set('whatsappNumber', $any($event.target).value)" [attr.aria-invalid]="problem('whatsappNumber') ? true : null" [attr.aria-describedby]="problem('whatsappNumber') ? 'cf-wa-error' : null" />
            @if (problem('whatsappNumber'); as key) {
              <p id="cf-wa-error" class="mt-1 text-sm text-destructive">{{ key | t }}</p>
            }
          </div>
          <div>
            <label appLabel for="cf-email">{{ 'crm.customers.fields.email' | t }}</label>
            <input appInput id="cf-email" type="email" inputmode="email" autocomplete="email" dir="ltr" placeholder="name@company.com" [value]="m().email" (input)="set('email', $any($event.target).value)" [attr.aria-invalid]="problem('email') ? true : null" [attr.aria-describedby]="problem('email') ? 'cf-email-error' : null" />
            @if (problem('email'); as key) {
              <p id="cf-email-error" class="mt-1 text-sm text-destructive">{{ key | t }}</p>
            }
          </div>
          <div>
            <label appLabel for="cf-web">{{ 'crm.customers.fields.website' | t }}</label>
            <input appInput id="cf-web" type="url" inputmode="url" dir="ltr" placeholder="https://www.example.com" [value]="m().website" (input)="set('website', $any($event.target).value)" [attr.aria-invalid]="problem('website') ? true : null" [attr.aria-describedby]="problem('website') ? 'cf-web-error' : null" />
            @if (problem('website'); as key) {
              <p id="cf-web-error" class="mt-1 text-sm text-destructive">{{ key | t }}</p>
            }
          </div>
        </div>
      </section>

      <section appCard aria-labelledby="cf-location">
        <div appCardHeader><h2 appCardTitle id="cf-location">{{ 'crm.customers.sections.location' | t }}</h2></div>
        <div appCardContent class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label appLabel for="cf-gov">{{ 'crm.customers.fields.governorateCode' | t }}</label>
            <app-select>
              <select appSelect id="cf-gov" [value]="m().governorateCode" (change)="set('governorateCode', $any($event.target).value); set('cityCode', '')">
                <option value="">—</option>
                @for (option of reference.options('governorate'); track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </app-select>
          </div>
          <div>
            <label appLabel for="cf-city">{{ 'crm.customers.fields.cityCode' | t }}</label>
            <app-select>
              <select appSelect id="cf-city" [value]="m().cityCode" [disabled]="!m().governorateCode" (change)="set('cityCode', $any($event.target).value)">
                <option value="">—</option>
                @for (option of cities(); track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </app-select>
          </div>
          <div>
            <label appLabel for="cf-maps">{{ 'crm.customers.fields.googleMapsUrl' | t }}</label>
            <input appInput id="cf-maps" type="url" inputmode="url" dir="ltr" placeholder="https://maps.google.com/…" [value]="m().googleMapsUrl" (input)="set('googleMapsUrl', $any($event.target).value)" [attr.aria-invalid]="problem('googleMapsUrl') ? true : null" [attr.aria-describedby]="problem('googleMapsUrl') ? 'cf-maps-error' : null" />
            @if (problem('googleMapsUrl'); as key) {
              <p id="cf-maps-error" class="mt-1 text-sm text-destructive">{{ key | t }}</p>
            }
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <label appLabel for="cf-address">{{ 'crm.customers.fields.addressLine' | t }}</label>
            <input appInput id="cf-address" [value]="m().addressLine" (input)="set('addressLine', $any($event.target).value)" />
          </div>
          <div>
            <label appLabel for="cf-lat">{{ 'customerForm.latitude' | t }}</label>
            <input appInput id="cf-lat" type="number" step="any" dir="ltr" [value]="m().latitude" (input)="set('latitude', $any($event.target).value)" />
          </div>
          <div>
            <label appLabel for="cf-lng">{{ 'customerForm.longitude' | t }}</label>
            <input appInput id="cf-lng" type="number" step="any" dir="ltr" [value]="m().longitude" (input)="set('longitude', $any($event.target).value)" [attr.aria-invalid]="problem('longitude') ? true : null" [attr.aria-describedby]="problem('longitude') ? 'cf-lng-error' : null" />
            @if (problem('longitude'); as key) {
              <p id="cf-lng-error" class="mt-1 text-sm text-destructive">{{ key | t }}</p>
            }
          </div>
        </div>
      </section>

      <section appCard aria-labelledby="cf-reg">
        <div appCardHeader><h2 appCardTitle id="cf-reg">{{ 'crm.customers.sections.registration' | t }}</h2></div>
        <div appCardContent class="grid gap-4 sm:grid-cols-2">
          <div>
            <label appLabel for="cf-tax">{{ 'crm.customers.fields.taxRegistrationNo' | t }}</label>
            <input appInput id="cf-tax" dir="ltr" inputmode="numeric" placeholder="123-456-789" [value]="m().taxRegistrationNo" (input)="set('taxRegistrationNo', $any($event.target).value)" [attr.aria-invalid]="problem('taxRegistrationNo') ? true : null" [attr.aria-describedby]="problem('taxRegistrationNo') ? 'cf-tax-error' : null" />
            @if (problem('taxRegistrationNo'); as key) {
              <p id="cf-tax-error" class="mt-1 text-sm text-destructive">{{ key | t }}</p>
            }
          </div>
          <div>
            <label appLabel for="cf-cr">{{ 'crm.customers.fields.commercialRegistrationNo' | t }}</label>
            <input appInput id="cf-cr" dir="ltr" inputmode="numeric" [value]="m().commercialRegistrationNo" (input)="set('commercialRegistrationNo', $any($event.target).value)" [attr.aria-invalid]="problem('commercialRegistrationNo') ? true : null" [attr.aria-describedby]="problem('commercialRegistrationNo') ? 'cf-cr-error' : null" />
            @if (problem('commercialRegistrationNo'); as key) {
              <p id="cf-cr-error" class="mt-1 text-sm text-destructive">{{ key | t }}</p>
            }
          </div>
          <div>
            <label appLabel for="cf-billing">{{ 'customerForm.billingEntity' | t }}</label>
            <input appInput id="cf-billing" [value]="m().billingEntity" (input)="set('billingEntity', $any($event.target).value)" />
          </div>
          <div>
            <label appLabel for="cf-billing-address">{{ 'customerForm.billingAddress' | t }}</label>
            <input appInput id="cf-billing-address" [value]="m().billingAddress" (input)="set('billingAddress', $any($event.target).value)" />
          </div>
        </div>
      </section>

      <section appCard aria-labelledby="cf-assign">
        <div appCardHeader><h2 appCardTitle id="cf-assign">{{ 'crm.customers.sections.assignment' | t }}</h2></div>
        <div appCardContent class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label appLabel for="cf-source">{{ 'crm.customers.fields.leadSourceCode' | t }}</label>
            <app-select>
              <select appSelect id="cf-source" [value]="m().leadSourceCode" (change)="set('leadSourceCode', $any($event.target).value)">
                <option value="">—</option>
                @for (option of reference.options('lead_source'); track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </app-select>
          </div>
          <div>
            <label appLabel for="cf-campaign">{{ 'analytics.filters.campaign' | t }}</label>
            <app-select>
              <select appSelect id="cf-campaign" [value]="m().campaignCode" (change)="set('campaignCode', $any($event.target).value)">
                <option value="">—</option>
                @for (option of reference.options('campaign'); track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </app-select>
          </div>
          @if (!id() && auth.can('customers.assign')) {
            <div>
              <label appLabel for="cf-owner">{{ 'crm.common.owner' | t }}</label>
              <app-user-select inputId="cf-owner" [value]="m().ownerId" (valueChange)="set('ownerId', $event)" />
            </div>
          }
          <div>
            <label appLabel for="cf-follow">{{ 'crm.customers.fields.nextFollowUpAt' | t }}</label>
            <input appInput id="cf-follow" type="datetime-local" dir="ltr" [value]="m().nextFollowUpAt" (change)="set('nextFollowUpAt', $any($event.target).value)" />
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <label appLabel for="cf-notes">{{ 'crm.customers.fields.notes' | t }}</label>
            <textarea appTextarea id="cf-notes" rows="3" [value]="m().notes" (input)="set('notes', $any($event.target).value)"></textarea>
          </div>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button type="submit" appButton [disabled]="busy()" aria-keyshortcuts="Control+S Meta+S">{{ (busy() ? 'crm.common.saving' : 'crm.common.save') | t }}</button>
        <a appButton variant="ghost" [routerLink]="id() ? ['/', i18n.locale(), 'customers', id()] : ['/', i18n.locale(), 'customers']">{{ 'crm.common.cancel' | t }}</a>
        <span class="hidden text-xs text-muted-foreground sm:inline" aria-hidden="true">{{ 'ux.forms.saveHint' | t }}</span>
      </div>
    </form>
    }
  `,
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

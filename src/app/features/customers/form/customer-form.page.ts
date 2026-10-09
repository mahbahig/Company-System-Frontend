import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
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
  imports: [RouterLink, TranslatePipe, UserSelectComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-page-header [heading]="(id() ? 'crm.customers.editTitle' : 'crm.customers.newTitle') | t" class="!mb-0" />
    @if (error(); as text) {
      <app-alert variant="destructive">{{ text }}</app-alert>
    }

    @if (duplicates(); as matches) {
      <section appCard class="border-warning" aria-labelledby="dup-title" role="alert">
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

    <form class="flex flex-col gap-6" (submit)="onSubmit($event)" novalidate>
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
            <input appInput id="cf-contact" [value]="m().primaryContactName" (input)="set('primaryContactName', $any($event.target).value)" />
          </div>
          @if (m().kind === 'company') {
            <div>
              <label appLabel for="cf-name-ar" required>{{ 'customerForm.nameAr' | t }}</label>
              <input appInput id="cf-name-ar" dir="rtl" [value]="m().nameAr" (input)="set('nameAr', $any($event.target).value)" />
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
            <input appInput id="cf-mobile" type="tel" inputmode="tel" dir="ltr" [value]="m().mobile" (input)="set('mobile', $any($event.target).value)" />
            <p class="mt-1 text-xs text-muted-foreground">{{ 'crm.customers.hints.mobile' | t }}</p>
          </div>
          <div>
            <label appLabel for="cf-landline">{{ 'crm.customers.fields.landline' | t }}</label>
            <input appInput id="cf-landline" type="tel" dir="ltr" [value]="m().landline" (input)="set('landline', $any($event.target).value)" />
          </div>
          <div>
            <label appLabel for="cf-wa">{{ 'crm.customers.fields.whatsappNumber' | t }}</label>
            <input appInput id="cf-wa" type="tel" dir="ltr" [value]="m().whatsappNumber" (input)="set('whatsappNumber', $any($event.target).value)" />
          </div>
          <div>
            <label appLabel for="cf-email">{{ 'crm.customers.fields.email' | t }}</label>
            <input appInput id="cf-email" type="email" dir="ltr" [value]="m().email" (input)="set('email', $any($event.target).value)" />
          </div>
          <div>
            <label appLabel for="cf-web">{{ 'crm.customers.fields.website' | t }}</label>
            <input appInput id="cf-web" type="url" dir="ltr" [value]="m().website" (input)="set('website', $any($event.target).value)" />
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
            <input appInput id="cf-maps" type="url" dir="ltr" [value]="m().googleMapsUrl" (input)="set('googleMapsUrl', $any($event.target).value)" />
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
            <input appInput id="cf-lng" type="number" step="any" dir="ltr" [value]="m().longitude" (input)="set('longitude', $any($event.target).value)" />
          </div>
        </div>
      </section>

      <section appCard aria-labelledby="cf-reg">
        <div appCardHeader><h2 appCardTitle id="cf-reg">{{ 'crm.customers.sections.registration' | t }}</h2></div>
        <div appCardContent class="grid gap-4 sm:grid-cols-2">
          <div>
            <label appLabel for="cf-tax">{{ 'crm.customers.fields.taxRegistrationNo' | t }}</label>
            <input appInput id="cf-tax" dir="ltr" [value]="m().taxRegistrationNo" (input)="set('taxRegistrationNo', $any($event.target).value)" />
          </div>
          <div>
            <label appLabel for="cf-cr">{{ 'crm.customers.fields.commercialRegistrationNo' | t }}</label>
            <input appInput id="cf-cr" dir="ltr" [value]="m().commercialRegistrationNo" (input)="set('commercialRegistrationNo', $any($event.target).value)" />
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

      <div class="flex gap-2">
        <button type="submit" appButton [disabled]="busy() || !valid()">{{ 'crm.common.save' | t }}</button>
        <a appButton variant="outline" [routerLink]="id() ? ['/', i18n.locale(), 'customers', id()] : ['/', i18n.locale(), 'customers']">{{ 'crm.common.cancel' | t }}</a>
      </div>
    </form>
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class CustomerFormPage {
  private readonly customers = inject(CustomersApi);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);

  /** Route param on `/customers/:id/edit`. */
  readonly id = input<string>();

  protected readonly m = signal<Model>({ ...EMPTY });
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

  protected readonly valid = computed(() => {
    const m = this.m();
    const named = m.kind === 'company' ? !!(m.nameAr.trim() || m.nameEn.trim()) : !!m.primaryContactName.trim();
    return named && !!(m.mobile.trim() || m.landline.trim()) && !!m.latitude === !!m.longitude;
  });

  constructor() {
    void this.reference.load();
    effect(() => {
      const id = this.id();
      if (id) void this.loadExisting(id);
    });
  }

  private async loadExisting(id: string): Promise<void> {
    try {
      const { customer } = await firstValueFrom(this.customers.get(id));
      this.m.set(this.toModel(customer as Customer & Record<string, unknown>));
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
    void this.save(false);
  }

  protected async save(confirmDuplicate: boolean): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
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
          this.duplicates.set(matches);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
      const result = id
        ? await firstValueFrom(this.api.patch<{ customer?: Customer; id?: string }>(`customers/${id}`, body))
        : await firstValueFrom(this.api.post<{ customer?: Customer; id?: string }>('customers', { ...body, confirmDuplicate: confirmDuplicate || undefined }));
      const savedId = id ?? result.customer?.id ?? result.id;
      await this.router.navigate(['/', this.i18n.locale(), 'customers', savedId]);
    } catch (error) {
      if (ApiError.is(error) && error.status === 409 && error.messageKey === 'errors.possibleDuplicates') {
        const details = error.details as { matches?: DuplicateMatch[] } | undefined;
        this.duplicates.set(details?.matches ?? []);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        this.error.set(this.i18n.errorText(error));
      }
    } finally {
      this.busy.set(false);
    }
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

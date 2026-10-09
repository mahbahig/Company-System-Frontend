import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { RecordPickerComponent } from '../../../shared/crm/record-picker/record-picker.component';
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
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { formatPhone } from '../../../shared/utils/format';
import { LeadsApi } from '../leads-api.service';
import type { ConvertLeadPayload } from '../models/convert-lead.interface';
import type { DuplicateMatches } from '../models/duplicate-matches.interface';
import type { Lead } from '../models/lead.interface';

type CustomerKind = 'individual' | 'company' | 'government' | 'ngo';

/** Arabic then English customer name, as the server derives them (Arabic-script value → Arabic name). */
function customerNames(lead: Lead): string[] {
  const arabic = /[؀-ۿ]/;
  const candidates = [lead.companyName, lead.name].map((value) => value?.trim()).filter((value): value is string => !!value);
  const nameAr = candidates.find((value) => arabic.test(value)) ?? candidates[0];
  const nameEn = candidates.find((value) => !arabic.test(value) && value !== nameAr);
  return [nameAr, nameEn].filter((value): value is string => !!value);
}

/** The completeness gates a lead must pass before it can be converted. */
const CONVERSION_GATES = ['qualified', 'convert'];

/**
 * CONV-01..11 conversion. Everything already on the lead (customer name,
 * location, category, activity, phone, contact, solution, size, value) is
 * shown read-only and taken by the server; missing required items send the
 * user back to Edit lead. The page only asks for what a lead does not hold:
 * new vs existing customer, customer type, the contact's role, an optional
 * site and the first opportunity's dates.
 */
@Component({
  selector: 'app-lead-convert-page',
  imports: [
    RouterLink,
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
    RecordPickerComponent,
  ],
  templateUrl: './lead-convert.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class LeadConvertPage {
  private readonly leads = inject(LeadsApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  readonly id = input.required<string>();

  protected readonly detail = rxResource({ params: () => this.id(), stream: ({ params }) => this.leads.get(params) });
  protected readonly lead = computed<Lead | null>(() => (this.detail.hasValue() ? this.detail.value().lead : null));
  protected readonly errorKey = signal<string | null>(null);
  protected readonly duplicates = signal<DuplicateMatches | null>(null);
  protected readonly submitting = signal(false);
  /** Set on the first Convert click: required fields left empty are then flagged. */
  protected readonly attempted = signal(false);

  protected readonly kinds: CustomerKind[] = ['individual', 'company', 'government', 'ngo'];

  // What the lead does not hold.
  protected readonly linkExisting = signal(false);
  protected readonly existingCustomerId = signal('');
  protected readonly customerKind = signal<CustomerKind>('company');
  protected readonly nameEn = signal('');
  protected readonly contactRoleCode = signal('');
  protected readonly contactJobTitle = signal('');
  protected readonly createSite = signal(true);
  protected readonly siteName = signal('');
  protected readonly siteGovernorateCode = signal('');
  protected readonly siteAddressLine = signal('');
  protected readonly createOpportunity = signal(true);
  protected readonly opportunityName = signal('');
  protected readonly solutionTypeCode = signal('');
  protected readonly expectedCloseDate = signal('');
  protected readonly nextAction = signal('');
  protected readonly nextActionAt = signal('');

  /** Required items still missing on the lead (filled through Edit lead, never here). */
  protected readonly missing = computed(() => {
    if (!this.detail.hasValue()) return [];
    return this.detail.value().completeness.missing.filter((item) => !item.satisfied && item.level === 'gate' && CONVERSION_GATES.includes(item.gate ?? ''));
  });
  protected readonly notQualified = computed(() => this.lead()?.status !== 'qualified');

  /** Primary contact the server will create: decision maker, else contact person, else the lead name. */
  protected readonly contactName = computed(() => {
    const lead = this.lead();
    return lead ? lead.qualification?.decisionMakerName || lead.contactPerson || lead.name : '';
  });

  /** Read-only summary of what is carried from the lead. */
  protected readonly summary = computed(() => {
    const lead = this.lead();
    if (!lead) return [];
    const money = (value?: number) => (value ? this.i18n.formatMoney(value) : '');
    const rows: Array<[string, string]> = [
      ['name', customerNames(lead).join(' / ')],
      ['governorate', this.reference.label('governorate', lead.governorateCode)],
      ['address', lead.addressLine ?? ''],
      ['category', this.reference.label('customer_category', lead.categoryCode)],
      ['sector', this.reference.label('sector', lead.sectorCode)],
      ['phone', formatPhone(lead.phone) ?? lead.phone ?? ''],
      ['email', lead.email ?? ''],
      ['contact', [this.contactName(), lead.qualification?.decisionMakerRole].filter(Boolean).join(' — ')],
      ['solutionType', this.reference.label('solution_type', lead.solutionTypeCode)],
      ['size', lead.qualification?.estimatedSizeKwp ? `${this.i18n.formatNumber(lead.qualification.estimatedSizeKwp)} kWp` : ''],
      ['value', money(lead.estimatedValue ?? lead.qualification?.budget)],
    ];
    return rows.map(([key, value]) => ({ key, value }));
  });

  /** Required (*) fields of this page that are still empty, as label keys. */
  protected readonly emptyRequired = computed(() => {
    const empty: string[] = [];
    if (this.linkExisting() && !this.existingCustomerId()) empty.push('crm.leads.convert.pickCustomer');
    if (this.createSite() && !this.siteName().trim()) empty.push('crm.leads.convert.siteName');
    if (this.createSite() && !this.siteGovernorateCode()) empty.push('crm.leads.convert.siteGovernorate');
    if (this.createOpportunity() && !this.lead()?.solutionTypeCode && !this.solutionTypeCode()) empty.push('crm.leads.fields.solutionTypeCode');
    return empty;
  });

  protected readonly canSubmit = computed(() => !!this.lead() && !this.notQualified() && this.missing().length === 0 && this.emptyRequired().length === 0);

  private prefilledFor: string | null = null;

  constructor() {
    void this.reference.load();
    effect(() => this.prefill());
  }

  /** Defaults for the few things asked here, derived from the lead (once per lead). */
  private prefill(): void {
    const lead = this.lead();
    if (!lead || this.prefilledFor === lead.id) return;
    this.prefilledFor = lead.id;
    this.customerKind.set(lead.categoryCode === 'residential' || (!lead.companyName && !lead.categoryCode) ? 'individual' : 'company');
    this.contactRoleCode.set(lead.qualification?.decisionMakerName ? 'decision_maker' : '');
    this.contactJobTitle.set(lead.qualification?.decisionMakerName ? (lead.qualification.decisionMakerRole ?? '') : '');
    this.siteName.set(this.i18n.t('crm.leads.convert.siteDefaultName'));
    this.siteGovernorateCode.set(lead.governorateCode ?? '');
    this.siteAddressLine.set(lead.addressLine ?? '');
    const size = lead.qualification?.estimatedSizeKwp;
    this.opportunityName.set(`${lead.companyName || lead.name}${size ? ` — ${size} kWp` : ''}`);
  }

  private toPayload(confirmDuplicate: boolean): ConvertLeadPayload {
    return {
      existingCustomerId: this.linkExisting() ? this.existingCustomerId() : undefined,
      customer: this.linkExisting() ? undefined : { kind: this.customerKind(), nameEn: this.nameEn().trim() || undefined },
      contact: { roleCode: this.contactRoleCode() || undefined, jobTitle: this.contactJobTitle().trim() || undefined },
      site: this.createSite()
        ? { name: this.siteName().trim(), governorateCode: this.siteGovernorateCode(), addressLine: this.siteAddressLine().trim() || undefined }
        : undefined,
      opportunity: this.createOpportunity()
        ? {
            name: this.opportunityName().trim() || undefined,
            solutionTypeCode: this.lead()?.solutionTypeCode ? undefined : this.solutionTypeCode() || undefined,
            expectedCloseDate: this.expectedCloseDate() || undefined,
            nextAction: this.nextAction().trim() || undefined,
            nextActionAt: this.nextActionAt() || undefined,
          }
        : undefined,
      confirmDuplicate: confirmDuplicate || undefined,
    };
  }

  protected async onSubmit(event: Event, confirmDuplicate = false): Promise<void> {
    event.preventDefault();
    this.attempted.set(true);
    if (!this.canSubmit() || this.submitting()) return;
    this.errorKey.set(null);
    this.submitting.set(true);
    try {
      const result = await firstValueFrom(this.leads.convert(this.id(), this.toPayload(confirmDuplicate)));
      await this.router.navigate(['/', this.i18n.locale(), 'customers', result.customerId]);
    } catch (error) {
      if (ApiError.is(error) && error.status === 409 && error.messageKey !== 'errors.ownershipConflict') {
        // The lead check returns `customerMatches`; the customer check (during conversion) returns `matches`.
        const details = (error.details ?? {}) as Partial<DuplicateMatches> & { matches?: DuplicateMatches['customerMatches'] };
        this.duplicates.set({ customerMatches: details.customerMatches ?? details.matches ?? [], leadMatches: details.leadMatches ?? [] });
        return;
      }
      this.errorKey.set(ApiError.is(error) && this.i18n.has(error.messageKey) ? error.messageKey : 'errors.db.unexpected');
    } finally {
      this.submitting.set(false);
    }
  }

  protected confirmAnyway(event: Event): void {
    void this.onSubmit(event, true);
  }

  protected cancelDuplicates(): void {
    this.duplicates.set(null);
  }

  /** Use the matching customer instead of creating a new one, and convert straight away. */
  protected linkTo(event: Event, customerId: string): void {
    this.linkExisting.set(true);
    this.existingCustomerId.set(customerId);
    this.duplicates.set(null);
    void this.onSubmit(event);
  }

  /** Scores come as 0–1 from the customer check and 0–100 from the lead check. */
  protected percent(score: number): number {
    return Math.round(score <= 1 ? score * 100 : score);
  }
}

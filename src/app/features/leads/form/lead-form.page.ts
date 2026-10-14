import { Component, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, form, max, min, required, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { FormDraft } from '../../../core/forms/form-draft';
import { UnsavedChanges, type HasUnsavedChanges } from '../../../core/forms/unsaved-changes';
import { SaveShortcutDirective } from '../../../core/shortcuts/save-shortcut.directive';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { DraftBannerComponent } from '../../../shared/crm/draft-banner/draft-banner.component';
import { emailValidator, mobileValidator, phoneValidator } from '../../../shared/utils/contact-validation';
import { focusFirstInvalid } from '../../../shared/utils/focus-invalid';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
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
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { LeadsApi } from '../leads-api.service';
import type { CreateLeadPayload } from '../models/create-lead-payload.interface';
import type { LeadFields } from '../models/lead-fields.interface';
import type { Qualification } from '../models/qualification.interface';

interface LeadFormModel {
  name: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  altPhone: string;
  email: string;
  governorateCode: string;
  cityCode: string;
  addressLine: string;
  categoryCode: string;
  sectorCode: string;
  requestedServiceCode: string;
  solutionTypeCode: string;
  sourceCode: string;
  campaignCode: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  estimatedValue: number | null;
  qualityCode: string;
  nextFollowUpAt: string;
  nextAction: string;
  notes: string;
  q: QualificationModel;
}

/** LEAD-18 qualification block (numbers kept as `null` when empty). */
interface QualificationModel {
  avgMonthlyConsumptionKwh: number | null;
  avgMonthlyBill: number | null;
  estimatedSizeKwp: number | null;
  budget: number | null;
  financingInterest: boolean;
  timeline: string;
  interestLevel: number | null;
  decisionMakerName: string;
  decisionMakerRole: string;
  siteAvailability: string;
  requirements: string;
}

const EMPTY_Q: QualificationModel = {
  avgMonthlyConsumptionKwh: null,
  avgMonthlyBill: null,
  estimatedSizeKwp: null,
  budget: null,
  financingInterest: false,
  timeline: '',
  interestLevel: null,
  decisionMakerName: '',
  decisionMakerRole: '',
  siteAvailability: '',
  requirements: '',
};

const TIMELINES = ['immediate', '1_3_months', '3_6_months', '6_12_months', 'over_12_months'] as const;

const EMPTY: LeadFormModel = {
  name: '',
  companyName: '',
  contactPerson: '',
  phone: '',
  altPhone: '',
  email: '',
  governorateCode: '',
  cityCode: '',
  addressLine: '',
  categoryCode: '',
  sectorCode: '',
  requestedServiceCode: '',
  solutionTypeCode: '',
  sourceCode: '',
  campaignCode: '',
  priority: 'normal',
  estimatedValue: null,
  qualityCode: '',
  nextFollowUpAt: '',
  nextAction: '',
  notes: '',
  q: { ...EMPTY_Q },
};

/** Full lead form (`LEAD-01/02`): create at `/leads/new`, edit at `/leads/:id/edit`. */
@Component({
  selector: 'app-lead-form-page',
  imports: [
    FormField,
    RouterLink,
    SaveShortcutDirective,
    BreadcrumbsComponent,
    DraftBannerComponent,
    TranslatePipe,
    PageHeaderComponent,
    AlertComponent,
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
  ],
  templateUrl: './lead-form.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class LeadFormPage implements HasUnsavedChanges {
  private readonly leads = inject(LeadsApi);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  /** Route param; absent on `/leads/new`. */
  readonly id = input<string>();

  protected readonly timelines = TIMELINES;
  protected readonly isEdit = computed(() => !!this.id());
  protected readonly errorKey = signal<string | null>(null);

  protected readonly existing = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.leads.get(params),
  });

  protected readonly readOnly = computed(() => {
    const status = this.existing.value()?.lead.status;
    return status === 'converted' || status === 'closed';
  });
  /** Not final, but the server would refuse an edit now (e.g. during the handoff, or another rep's stage). */
  protected readonly locked = computed(() => !this.readOnly() && this.existing.hasValue() && this.existing.value().canEdit === false);
  /** Server field errors from the last save, cleared as soon as the field is edited. */
  private readonly serverErrors = signal<Record<string, string>>({});
  /** The qualification block is optional detail: collapsed on a new lead until opened (or until it holds values / an error). */
  protected readonly showQualification = signal(false);
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('navigation.items.leads'), path: '/leads' },
    ...(this.isEdit() ? [{ label: this.existing.value()?.lead.name ?? '', path: this.id() ? `/leads/${this.id()}` : undefined }] : []),
    { label: this.i18n.t(this.isEdit() ? 'crm.leads.editTitle' : 'crm.leads.newTitle') },
  ]);

  private readonly model = signal<LeadFormModel>({ ...EMPTY });
  protected readonly leadForm = form(this.model, (path) => {
    required(path.name, { message: 'validation.required' });
    required(path.phone, { message: 'validation.required' });
    validate(path.phone, mobileValidator);
    validate(path.altPhone, phoneValidator);
    validate(path.email, emailValidator);
    required(path.sourceCode, { message: 'validation.required' });
    for (const field of [path.q.avgMonthlyConsumptionKwh, path.q.avgMonthlyBill, path.q.estimatedSizeKwp, path.q.budget]) min(field, 0, { message: 'validation.mustBePositive' });
    min(path.q.interestLevel, 1, { message: 'validation.mustBePositive' });
    max(path.q.interestLevel, 5, { message: 'validation.mustBePositive' });
  });

  /** Unsent input of a NEW lead, kept in this browser only (never sent until Save). */
  protected readonly draft = new FormDraft<LeadFormModel>('lead.new', this.model, {
    enabled: () => !this.isEdit(),
    dirty: () => this.leadForm().dirty(),
  });
  private saved = false;

  constructor() {
    void this.reference.load();
    effect(() => this.loadIntoForm());
    inject(UnsavedChanges).track(() => this.hasUnsavedChanges());
    // Clear a field's server error once the user changes that field.
    effect(() => {
      this.model();
      untracked(() => {
        const errors = this.serverErrors();
        const remaining = Object.fromEntries(Object.entries(errors).filter(([field]) => this.valueAt(field) === this.erroredValues[field]));
        if (Object.keys(remaining).length !== Object.keys(errors).length) this.serverErrors.set(remaining);
      });
    });
  }

  private erroredValues: Record<string, unknown> = {};

  hasUnsavedChanges(): boolean {
    return !this.saved && !this.readOnly() && this.leadForm().dirty();
  }

  protected restoreDraft(): void {
    this.draft.restore((value) => {
      this.model.set({ ...EMPTY, ...value, q: { ...EMPTY_Q, ...(value.q ?? {}) } });
      if (Object.values(value.q ?? {}).some((entry) => entry !== null && entry !== '' && entry !== false)) this.showQualification.set(true);
    });
  }

  private valueAt(field: string): unknown {
    return field.split('.').reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), this.model());
  }

  private loadIntoForm(): void {
    const lead = this.existing.value()?.lead;
    if (!lead) return;
    if (lead.qualification && Object.values(lead.qualification).some((value) => value !== null && value !== undefined && value !== '')) this.showQualification.set(true);
    this.model.set({
      name: lead.name,
      companyName: lead.companyName ?? '',
      contactPerson: lead.contactPerson ?? '',
      phone: lead.phone ?? '',
      altPhone: lead.altPhone ?? '',
      email: lead.email ?? '',
      governorateCode: lead.governorateCode ?? '',
      cityCode: lead.cityCode ?? '',
      addressLine: lead.addressLine ?? '',
      categoryCode: lead.categoryCode ?? '',
      sectorCode: lead.sectorCode ?? '',
      requestedServiceCode: lead.requestedServiceCode ?? '',
      solutionTypeCode: lead.solutionTypeCode ?? '',
      sourceCode: lead.sourceCode,
      campaignCode: lead.campaignCode ?? '',
      priority: lead.priority,
      estimatedValue: lead.estimatedValue ?? null,
      qualityCode: lead.qualityCode ?? '',
      nextFollowUpAt: lead.nextFollowUpAt?.slice(0, 10) ?? '',
      nextAction: lead.nextAction ?? '',
      notes: lead.notes ?? '',
      q: {
        avgMonthlyConsumptionKwh: lead.qualification?.avgMonthlyConsumptionKwh ?? null,
        avgMonthlyBill: lead.qualification?.avgMonthlyBill ?? null,
        estimatedSizeKwp: lead.qualification?.estimatedSizeKwp ?? null,
        budget: lead.qualification?.budget ?? null,
        financingInterest: lead.qualification?.financingInterest ?? false,
        timeline: lead.qualification?.timeline ?? '',
        interestLevel: lead.qualification?.interestLevel ?? null,
        decisionMakerName: lead.qualification?.decisionMakerName ?? '',
        decisionMakerRole: lead.qualification?.decisionMakerRole ?? '',
        siteAvailability: lead.qualification?.siteAvailability ?? '',
        requirements: lead.qualification?.requirements ?? '',
      },
    });
  }

  /** The first message for a field: the client check once touched, else the server's verdict from the last save. */
  protected fieldError(field: 'name' | 'phone' | 'altPhone' | 'email' | 'sourceCode'): string | null {
    const state = this.leadForm[field]();
    const client = state.touched() ? (state.errors()[0]?.message ?? null) : null;
    return client ?? this.serverErrors()[field] ?? null;
  }

  private toPayload(): LeadFields {
    const value = this.model();
    return {
      name: value.name,
      companyName: value.companyName || undefined,
      contactPerson: value.contactPerson || undefined,
      phone: value.phone,
      altPhone: value.altPhone || undefined,
      email: value.email || undefined,
      governorateCode: value.governorateCode || undefined,
      cityCode: value.cityCode || undefined,
      addressLine: value.addressLine || undefined,
      categoryCode: value.categoryCode || undefined,
      sectorCode: value.sectorCode || undefined,
      requestedServiceCode: value.requestedServiceCode || undefined,
      solutionTypeCode: value.solutionTypeCode || undefined,
      sourceCode: value.sourceCode,
      campaignCode: value.campaignCode || undefined,
      priority: value.priority,
      estimatedValue: value.estimatedValue ?? undefined,
      qualityCode: value.qualityCode || undefined,
      nextFollowUpAt: value.nextFollowUpAt || undefined,
      nextAction: value.nextAction || undefined,
      notes: value.notes || undefined,
      qualification: this.qualificationPayload(value.q),
    };
  }

  /** Only the qualification values that were entered (empty inputs are left out). */
  private qualificationPayload(q: QualificationModel): Qualification | undefined {
    const num = (value: number | null) => (value == null || String(value) === '' || !Number.isFinite(Number(value)) ? undefined : Number(value));
    const text = (value: string) => value.trim() || undefined;
    const out: Qualification = {
      avgMonthlyConsumptionKwh: num(q.avgMonthlyConsumptionKwh),
      avgMonthlyBill: num(q.avgMonthlyBill),
      estimatedSizeKwp: num(q.estimatedSizeKwp),
      budget: num(q.budget),
      financingInterest: q.financingInterest || undefined,
      timeline: (q.timeline || undefined) as Qualification['timeline'],
      interestLevel: num(q.interestLevel),
      decisionMakerName: text(q.decisionMakerName),
      decisionMakerRole: text(q.decisionMakerRole),
      siteAvailability: text(q.siteAvailability),
      requirements: text(q.requirements),
    };
    const entered = Object.fromEntries(Object.entries(out).filter(([, value]) => value !== undefined)) as Qualification;
    return Object.keys(entered).length ? entered : undefined;
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.leadForm().submitting()) return;
    this.leadForm().markAsTouched();
    if (this.leadForm().invalid()) {
      // Required fields show their own message; out-of-range qualification numbers are reported here.
      if (this.leadForm.q().invalid()) {
        this.errorKey.set('validation.mustBePositive');
        this.showQualification.set(true);
      }
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    this.errorKey.set(null);
    this.serverErrors.set({});

    await submit(this.leadForm, async () => {
      try {
        const id = this.id();
        const lead = id
          ? await firstValueFrom(this.leads.update(id, this.toPayload()))
          : await firstValueFrom(this.leads.create(this.toPayload() as CreateLeadPayload));
        this.saved = true;
        this.draft.clear();
        await this.router.navigate(['/', this.i18n.locale(), 'leads', lead.id]);
      } catch (error) {
        this.errorKey.set(ApiError.is(error) && this.i18n.has(error.messageKey) ? error.messageKey : 'errors.db.unexpected');
        if (ApiError.is(error) && Object.keys(error.fieldErrors).length) {
          this.serverErrors.set(error.fieldErrors);
          this.erroredValues = Object.fromEntries(Object.keys(error.fieldErrors).map((field) => [field, this.valueAt(field)]));
          if (Object.keys(error.fieldErrors).some((field) => field.startsWith('qualification.'))) this.showQualification.set(true);
          focusFirstInvalid(this.host.nativeElement);
        }
      }
      return undefined;
    });
  }
}

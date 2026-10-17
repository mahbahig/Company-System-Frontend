import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { LoaderCircle, MapPin } from 'lucide';
import { of } from 'rxjs';
import { UnsavedChanges, type HasUnsavedChanges } from '../../../core/forms/unsaved-changes';
import { SaveShortcutDirective } from '../../../core/shortcuts/save-shortcut.directive';

import { ApiError } from '../../../core/api/api-error';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CardContentDirective } from '../../../shared/ui/card/card-content.directive';
import { CardDirective } from '../../../shared/ui/card/card.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { SelectDirective } from '../../../shared/ui/form/select.directive';
import { TextareaDirective } from '../../../shared/ui/form/textarea.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import type { SiteWrite } from '../models/site-write.interface';
import type { Site } from '../models/site.interface';
import { SitesApi } from './sites-api.service';

const ROOF_CONDITIONS = ['good', 'fair', 'poor', 'needs_repair'] as const;
const ORIENTATIONS = ['north', 'north_east', 'east', 'south_east', 'south', 'south_west', 'west', 'north_west', 'flat'] as const;
const SHADING_LEVELS = ['none', 'partial', 'significant'] as const;
const METER_TYPES = ['single_phase', 'three_phase'] as const;
const VOLTAGE_LEVELS = ['lv', 'mv'] as const;

interface SiteFormModel {
  name: string;
  governorateCode: string;
  cityCode: string;
  addressLine: string;
  latitude: number | null;
  longitude: number | null;
  siteTypeCode: string;
  availableAreaM2: number | null;
  roofTypeCode: string;
  roofCondition: string;
  roofAgeYears: number | null;
  orientation: string;
  shading: string;
  utilityProviderCode: string;
  meterNumber: string;
  meterType: string;
  voltageLevel: string;
  contractedLoadKw: number | null;
  transformerKva: number | null;
  tariffCategory: string;
  avgMonthlyConsumptionKwh: number | null;
  avgMonthlyBillEgp: number | null;
  infrastructureNotes: string;
  notes: string;
}

const EMPTY_MODEL: SiteFormModel = {
  name: '',
  governorateCode: '',
  cityCode: '',
  addressLine: '',
  latitude: null,
  longitude: null,
  siteTypeCode: '',
  availableAreaM2: null,
  roofTypeCode: '',
  roofCondition: '',
  roofAgeYears: null,
  orientation: '',
  shading: '',
  utilityProviderCode: '',
  meterNumber: '',
  meterType: '',
  voltageLevel: '',
  contractedLoadKw: null,
  transformerKva: null,
  tariffCategory: '',
  avgMonthlyConsumptionKwh: null,
  avgMonthlyBillEgp: null,
  infrastructureNotes: '',
  notes: '',
};

const toModel = (site: Site): SiteFormModel => ({
  name: site.name,
  governorateCode: site.governorateCode,
  cityCode: site.cityCode ?? '',
  addressLine: site.addressLine ?? '',
  latitude: site.latitude ?? null,
  longitude: site.longitude ?? null,
  siteTypeCode: site.siteTypeCode ?? '',
  availableAreaM2: site.availableAreaM2 ?? null,
  roofTypeCode: site.roofTypeCode ?? '',
  roofCondition: site.roofCondition ?? '',
  roofAgeYears: site.roofAgeYears ?? null,
  orientation: site.orientation ?? '',
  shading: site.shading ?? '',
  utilityProviderCode: site.utilityProviderCode ?? '',
  meterNumber: site.meterNumber ?? '',
  meterType: site.meterType ?? '',
  voltageLevel: site.voltageLevel ?? '',
  contractedLoadKw: site.contractedLoadKw ?? null,
  transformerKva: site.transformerKva ?? null,
  tariffCategory: site.tariffCategory ?? '',
  avgMonthlyConsumptionKwh: site.avgMonthlyConsumptionKwh ?? null,
  avgMonthlyBillEgp: site.avgMonthlyBillEgp ?? null,
  infrastructureNotes: site.infrastructureNotes ?? '',
  notes: site.notes ?? '',
});

/** `/customers/:id/sites/new` and `/customers/:id/sites/:siteId/edit` (SITE-01..05). */
@Component({
  selector: 'app-site-form-page',
  imports: [SaveShortcutDirective, 
    RouterLink,
    FormField,
    TranslatePipe,
    PageHeaderComponent,
    AlertComponent,
    ButtonDirective,
    InputDirective,
    LabelComponent,
    SelectComponent,
    SelectDirective,
    TextareaDirective,
    IconComponent,
    CardDirective,
    CardContentDirective,
  ],
  templateUrl: './site-form.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class SiteFormPage implements HasUnsavedChanges {
  private saved = false;
  /** Asks before leaving with typed-in input (route change, tab close); quiet once saved. */
  private readonly unsavedTracking = inject(UnsavedChanges).track(() => this.hasUnsavedChanges());

  hasUnsavedChanges(): boolean {
    return !this.saved && this.siteForm().dirty();
  }

  private readonly sites = inject(SitesApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  readonly customerId = input.required<string>({ alias: 'id' });
  readonly siteId = input<string>();

  protected readonly roofConditions = ROOF_CONDITIONS;
  protected readonly orientations = ORIENTATIONS;
  protected readonly shadingLevels = SHADING_LEVELS;
  protected readonly meterTypes = METER_TYPES;
  protected readonly voltageLevels = VOLTAGE_LEVELS;
  protected readonly spinnerIcon = LoaderCircle;
  protected readonly mapPinIcon = MapPin;
  protected readonly isEdit = computed(() => !!this.siteId());
  protected readonly errorKey = signal<string | null>(null);

  protected readonly existing = rxResource({
    params: () => this.siteId(),
    stream: ({ params }) => (params ? this.sites.get(params) : of(null)),
  });

  private readonly model = signal<SiteFormModel>(EMPTY_MODEL);
  protected readonly siteForm = form(this.model, (path) => {
    required(path.name, { message: 'crm.validation.siteNameRequired' });
    required(path.governorateCode, { message: 'crm.validation.governorateRequired' });
  });

  private populated = false;

  constructor() {
    void this.reference.load();
    effect(() => {
      const site = this.existing.value();
      if (site && !this.populated) {
        this.populated = true;
        this.model.set(toModel(site));
      }
    });
  }

  protected error(field: keyof SiteFormModel): string | null {
    const state = this.siteForm[field]();
    return state.touched() ? (state.errors()[0]?.message ?? null) : null;
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorKey.set(null);
    this.siteForm().markAsTouched();
    await submit(this.siteForm, async () => {
      const value = this.model();
      const body: SiteWrite = {
        name: value.name,
        governorateCode: value.governorateCode,
        cityCode: value.cityCode || undefined,
        addressLine: value.addressLine || undefined,
        latitude: value.latitude ?? undefined,
        longitude: value.longitude ?? undefined,
        siteTypeCode: value.siteTypeCode || undefined,
        availableAreaM2: value.availableAreaM2 ?? undefined,
        roofTypeCode: value.roofTypeCode || undefined,
        roofCondition: value.roofCondition || undefined,
        roofAgeYears: value.roofAgeYears ?? undefined,
        orientation: value.orientation || undefined,
        shading: value.shading || undefined,
        utilityProviderCode: value.utilityProviderCode || undefined,
        meterNumber: value.meterNumber || undefined,
        meterType: (value.meterType || undefined) as SiteWrite['meterType'],
        voltageLevel: (value.voltageLevel || undefined) as SiteWrite['voltageLevel'],
        contractedLoadKw: value.contractedLoadKw ?? undefined,
        transformerKva: value.transformerKva ?? undefined,
        tariffCategory: value.tariffCategory || undefined,
        avgMonthlyConsumptionKwh: value.avgMonthlyConsumptionKwh ?? undefined,
        avgMonthlyBillEgp: value.avgMonthlyBillEgp ?? undefined,
        infrastructureNotes: value.infrastructureNotes || undefined,
        notes: value.notes || undefined,
      };
      try {
        await this.save(body);
        this.saved = true;
        await this.router.navigateByUrl(`/customers/${this.customerId()}`);
      } catch (error) {
        this.errorKey.set(this.messageFor(error));
      }
      return undefined;
    });
  }

  private async save(body: SiteWrite): Promise<void> {
    const id = this.siteId();
    const request$ = id ? this.sites.update(id, body) : this.sites.create(this.customerId(), body);
    await new Promise<void>((resolve, reject) => request$.subscribe({ next: () => resolve(), error: (error: unknown) => reject(error) }));
  }

  private messageFor(error: unknown): string {
    if (!ApiError.is(error)) return 'auth.errors.unexpected';
    return this.i18n.has(error.messageKey) ? error.messageKey : 'auth.errors.unexpected';
  }
}

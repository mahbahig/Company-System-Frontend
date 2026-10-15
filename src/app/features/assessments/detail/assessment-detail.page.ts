import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, switchMap, type Observable } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DocumentsPanelComponent } from '../../../shared/crm/documents-panel/documents-panel.component';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { userName } from '../../../shared/utils/display-name';
import { problemIds } from '../../../shared/utils/problem-ids';
import { BomEditorComponent } from '../../solar/editors/bom-editor.component';
import { DesignEditorComponent } from '../../solar/editors/design-editor.component';
import type { BomItem, SystemDesign } from '../../solar/solar.models';
import { AssessmentsApi, type AssessmentVersion } from '../assessments-api.service';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

const MONTHS = 12;
const FIELD_GROUPS = {
  siteMeasurements: ['availableAreaM2', 'usableAreaM2', 'roofLengthM', 'roofWidthM', 'buildingHeightM', 'distanceToPanelM', 'accessForEquipment'],
  roof: ['roofType', 'roofCondition', 'roofAgeYears', 'orientation', 'tiltDeg', 'shading'],
  electrical: ['utilityProvider', 'meterNumber', 'meterType', 'voltage', 'contractedLoadKw', 'mainBreakerA', 'transformerKva', 'earthing', 'panelLocation'],
} as const;
type Group = keyof typeof FIELD_GROUPS;

/**
 * TECH-01..05 solar assessment: consumption with the month-by-month bill
 * table, site / roof / electrical survey, system design and BOM. Submitted
 * versions go to the Technical Lead; an approved version is read-only and any
 * later change is a new version with a reason.
 */
@Component({
  selector: 'app-assessment-detail-page',
  imports: [DetailSkeletonComponent, RouterLink, TranslatePipe, StatusBadgeComponent, DocumentsPanelComponent, AlertComponent, ButtonDirective, PageHeaderComponent, DesignEditorComponent, BomEditorComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './assessment-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class AssessmentDetailPage {
  protected readonly api = inject(AssessmentsApi);
  protected readonly i18n = inject(I18nService);

  readonly id = input.required<string>();

  protected readonly months = Array.from({ length: MONTHS }, (_, index) => index);
  protected readonly groups = Object.keys(FIELD_GROUPS) as Group[];
  protected readonly consumptionFields = ['averageBillEgp', 'tariffCategory', 'dayLoadPct', 'nightLoadPct', 'peakDemandKw', 'loadProfileNotes'] as const;
  protected readonly noteFields = ['constraints', 'equipmentRequirements', 'engineeringCalculations', 'recommendations'] as const;

  protected readonly detail = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get(params) });
  protected readonly selected = linkedSignal(() => this.detail.value()?.assessment.currentVersion ?? 1);
  protected readonly version = computed<AssessmentVersion | undefined>(() => this.detail.value()?.assessment.versions.find((v) => v.version === this.selected()));
  protected readonly editable = computed(() => {
    const d = this.detail.value();
    return !!d?.canEdit && this.selected() === d.assessment.currentVersion && ['draft', 'returned'].includes(this.version()?.status ?? '');
  });

  protected readonly monthly = signal<Array<number | undefined>>([]);
  protected readonly consumption = signal<AssessmentVersion['consumption']>({});
  protected readonly groupValues = signal<Record<Group, Record<string, unknown>>>({ siteMeasurements: {}, roof: {}, electrical: {} });
  protected readonly notes = signal<Record<string, string>>({});
  protected readonly design = signal<SystemDesign>({});
  protected readonly bom = signal<BomItem[]>([]);
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  /** The last save / submit was rejected: required fields that are still empty are marked. */
  protected readonly failed = signal(false);
  /** Ids of the fields the server named in that rejection. */
  protected readonly problems = signal<ReadonlySet<string>>(new Set());
  protected readonly reason = signal('');
  protected readonly changeReason = signal('');

  protected readonly average = computed(() => {
    const values = this.monthly().filter((value): value is number => typeof value === 'number' && value > 0);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  });
  protected readonly annual = computed(() => this.monthly().reduce<number>((sum, value) => sum + (value ?? 0), 0));
  protected readonly opportunityId = computed(() => {
    const opp = this.detail.value()?.assessment.opportunityId;
    return typeof opp === 'object' ? opp.id : (opp ?? null);
  });
  protected readonly opportunityName = computed(() => {
    const opp = this.detail.value()?.assessment.opportunityId;
    return typeof opp === 'object' ? opp.name : this.i18n.t('crm.assessments.title');
  });

  constructor() {
    effect(() => {
      const v = this.version();
      if (!v) return;
      this.monthly.set([...(v.consumption?.monthlyKwh ?? [])]);
      this.consumption.set({ ...(v.consumption ?? {}) });
      this.groupValues.set({ siteMeasurements: { ...(v.siteMeasurements ?? {}) }, roof: { ...(v.roof ?? {}) }, electrical: { ...(v.electrical ?? {}) } });
      this.notes.set({ constraints: v.constraints ?? '', equipmentRequirements: v.equipmentRequirements ?? '', engineeringCalculations: v.engineeringCalculations ?? '', recommendations: v.recommendations ?? '' });
      this.design.set({ ...(v.design ?? {}) });
      this.bom.set([...(v.bom ?? [])].map((line) => ({ ...line, equipmentId: line.equipmentId ? String(line.equipmentId) : null })));
    });
  }

  protected fieldsOf(group: Group): readonly string[] {
    return FIELD_GROUPS[group];
  }

  protected groupValue(group: Group, key: string): string {
    const value = this.groupValues()[group][key];
    return value === null || value === undefined ? '' : String(value);
  }

  protected setGroup(group: Group, key: string, raw: string): void {
    const numeric = raw !== '' && !Number.isNaN(Number(raw));
    this.groupValues.update((all) => ({ ...all, [group]: { ...all[group], [key]: raw === '' ? null : numeric ? Number(raw) : raw } }));
  }

  protected setMonth(month: number, raw: string): void {
    this.monthly.update((values) => {
      const next = [...values];
      next[month] = raw === '' ? undefined : Number(raw);
      return next;
    });
  }

  protected setConsumption(key: string, raw: string): void {
    const text = key === 'tariffCategory' || key === 'loadProfileNotes';
    this.consumption.update((c) => ({ ...c, [key]: raw === '' ? undefined : text ? raw : Number(raw) }));
  }

  protected setNote(key: string, value: string): void {
    this.notes.update((n) => ({ ...n, [key]: value }));
  }

  protected monthLabel(month: number): string {
    return new Intl.DateTimeFormat(this.i18n.locale() === 'ar' ? 'ar-EG' : 'en-GB', { month: 'short' }).format(new Date(2026, month, 1));
  }

  protected name(value: Parameters<typeof userName>[1]): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    await this.act(this.saveRequest(), 'crm.assessments.versionSaved');
  }

  /** Submit sends what is on screen: save first, so unsaved entries are not reported as missing. */
  protected async submit(): Promise<void> {
    await this.act(this.saveRequest().pipe(switchMap(() => this.api.submit(this.id()))), 'crm.assessments.submitted');
  }

  private saveRequest() {
    const monthly = this.monthly().map((value) => value ?? 0).slice(0, MONTHS);
    return this.api.save(this.id(), {
      consumption: { ...this.consumption(), monthlyKwh: monthly.some((value) => value > 0) ? monthly : undefined, averageMonthlyKwh: this.average() || this.consumption().averageMonthlyKwh || undefined, annualKwh: this.annual() || undefined },
      siteMeasurements: clean(this.groupValues().siteMeasurements),
      roof: clean(this.groupValues().roof),
      electrical: clean(this.groupValues().electrical),
      ...this.notes(),
      design: this.design(),
      bom: this.bom().filter((line) => line.description.trim()),
    });
  }

  protected async act(action: Observable<unknown>, successKey: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      await firstValueFrom(action);
      this.failed.set(false);
      this.problems.set(new Set());
      this.message.set(this.i18n.t(successKey));
      this.reason.set('');
      this.changeReason.set('');
      this.detail.reload();
    } catch (error) {
      this.failed.set(true);
      this.problems.set(problemIds(error));
      this.error.set(this.i18n.errorText(error));
    } finally {
      this.busy.set(false);
    }
  }
}

function clean(record: Record<string, unknown>): Record<string, string | number | boolean | null> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as Record<string, string | number | boolean | null>;
}

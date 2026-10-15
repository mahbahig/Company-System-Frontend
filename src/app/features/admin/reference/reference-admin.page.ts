import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { ReferenceItem } from '../../../core/reference/reference-item.interface';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';

/** Lists editable here; campaigns have their own page (they carry budgets and ads). */
const TYPES = [
  'lead_source',
  'lead_status',
  'lead_quality',
  'lead_closure_reason',
  'customer_category',
  'customer_type',
  'customer_status',
  'sector',
  'governorate',
  'city',
  'service_type',
  'solution_type',
  'pipeline_stage',
  'loss_reason',
  'competitor',
  'call_purpose',
  'call_outcome',
  'visit_type',
  'visit_outcome',
  'task_priority',
  'contact_role',
  'site_type',
  'roof_type',
  'utility_provider',
  'negotiation_type',
  'document_category',
  'required_document',
];

/**
 * ADM-02 master data: every dropdown list in both languages, with order,
 * activation and type-specific extras (badge tone, stage probability…).
 * Codes never change once created, so history keeps its meaning.
 */
@Component({
  selector: 'app-reference-admin-page',
  imports: [SkeletonRowComponent, TranslatePipe, AlertComponent, BadgeComponent, ButtonDirective, DialogComponent, PageHeaderComponent, ...TABLE_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './reference-admin.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ReferenceAdminPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly types = TYPES;
  protected readonly tones = ['success', 'warning', 'danger', 'info', 'neutral'];

  readonly type = input<string>();
  protected readonly activeType = computed(() => (this.type() && TYPES.includes(this.type()!) ? this.type()! : TYPES[0]));
  protected readonly hasTone = computed(() => ['lead_status', 'customer_status', 'pipeline_stage', 'lead_quality', 'task_priority'].includes(this.activeType()));

  protected readonly items = rxResource({ params: () => this.activeType(), stream: ({ params }) => this.api.get<ReferenceItem[]>(`reference/${params}`, { all: true }) });
  protected readonly open = signal(false);
  protected readonly editing = signal<ReferenceItem | null>(null);
  protected readonly d = signal({ code: '', nameAr: '', nameEn: '', order: '', parentCode: '', tone: '', probability: '', isActive: true });
  protected readonly valid = computed(() => /^[a-z0-9][a-z0-9_-]{0,60}$/.test(this.d().code) && !!this.d().nameAr.trim() && !!this.d().nameEn.trim() && (this.activeType() !== 'city' || !!this.d().parentCode));

  constructor() {
    void this.reference.load();
  }

  protected pickType(type: string): void {
    void this.router.navigate([], { queryParams: { type }, queryParamsHandling: 'merge' });
  }

  protected edit(item: ReferenceItem | null): void {
    this.actions.error.set(null);
    this.editing.set(item);
    const meta = item?.meta ?? {};
    this.d.set({
      code: item?.code ?? '',
      nameAr: item?.nameAr ?? '',
      nameEn: item?.nameEn ?? '',
      order: item ? String(item.order ?? '') : String((this.items.value()?.length ?? 0) + 1),
      parentCode: item?.parentCode ?? '',
      tone: typeof meta['tone'] === 'string' ? (meta['tone'] as string) : '',
      probability: meta['probability'] !== undefined ? String(meta['probability']) : '',
      isActive: item?.isActive ?? true,
    });
    this.open.set(true);
  }

  protected set(key: 'code' | 'nameAr' | 'nameEn' | 'order' | 'parentCode' | 'tone' | 'probability', value: string): void {
    this.d.update((d) => ({ ...d, [key]: value }));
  }

  protected setActive(value: boolean): void {
    this.d.update((d) => ({ ...d, isActive: value }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    const d = this.d();
    const current = this.editing();
    const meta: Record<string, unknown> = { ...(current?.meta ?? {}) };
    if (this.hasTone()) meta['tone'] = d.tone || undefined;
    if (this.activeType() === 'pipeline_stage' && d.probability !== '') meta['probability'] = Number(d.probability);
    const body = { nameAr: d.nameAr.trim(), nameEn: d.nameEn.trim(), order: d.order === '' ? undefined : Number(d.order), parentCode: d.parentCode || undefined, isActive: d.isActive, meta };
    const request: Observable<ReferenceItem> = current ? this.api.patch(`reference/${this.activeType()}/${current.code}`, body) : this.api.post('reference', { ...body, type: this.activeType(), code: d.code });
    void this.actions.run(request, 'admin.saved', () => {
      this.open.set(false);
      this.items.reload();
      void this.reference.reload();
    });
  }
}

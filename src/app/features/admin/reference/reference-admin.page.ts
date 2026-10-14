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
  template: `
    <app-page-header [heading]="'admin.reference.title' | t" [subtitle]="'admin.reference.subtitle' | t" class="!mb-0">
      <button type="button" appButton (click)="edit(null)">{{ 'admin.reference.new' | t }}</button>
    </app-page-header>
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    <div class="max-w-sm">
      <label appLabel for="ref-type">{{ 'admin.reference.list' | t }}</label>
      <app-select>
        <select appSelect id="ref-type" [value]="activeType()" (change)="pickType($any($event.target).value)">
          @for (t of types; track t) {
            <option [value]="t">{{ 'admin.reference.types.' + t | t }}</option>
          }
        </select>
      </app-select>
    </div>
    <app-table-wrapper [label]="'admin.reference.types.' + activeType() | t" [attr.aria-busy]="items.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'admin.reference.order' | t }}</th>
            <th appTableHead>{{ 'admin.code' | t }}</th>
            <th appTableHead>{{ 'admin.nameAr' | t }}</th>
            <th appTableHead>{{ 'admin.nameEn' | t }}</th>
            @if (activeType() === 'city') {
              <th appTableHead>{{ 'crm.customers.fields.governorateCode' | t }}</th>
            }
            <th appTableHead>{{ 'admin.users.status' | t }}</th>
            <th appTableHead><span class="sr-only">{{ 'admin.actions' | t }}</span></th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (item of items.value() ?? []; track item.id) {
            <tr appTableRow>
              <td appTableCell class="tabular">{{ item.order }}</td>
              <td appTableCell class="font-mono text-xs" dir="ltr">{{ item.code }}</td>
              <td appTableCell dir="rtl">{{ item.nameAr }}</td>
              <td appTableCell dir="ltr">{{ item.nameEn }}</td>
              @if (activeType() === 'city') {
                <td appTableCell>{{ reference.label('governorate', item.parentCode) }}</td>
              }
              <td appTableCell>
                <app-badge [tone]="item.isActive ? 'success' : 'neutral'">{{ (item.isActive ? 'admin.active' : 'admin.inactive') | t }}</app-badge>
                @if (item.isSystem) {
                  <app-badge tone="info" class="ms-1">{{ 'admin.roles.system' | t }}</app-badge>
                }
              </td>
              <td appTableCell><button type="button" appButton variant="ghost" size="sm" (click)="edit(item)">{{ 'crm.common.edit' | t }}</button></td>
            </tr>
          } @empty {
            @if (items.isLoading()) {
              @for (i of [0, 1, 2, 3, 4]; track i) {
                <tr app-skeleton-row [columns]="7" [index]="i"></tr>
              }
            } @else {
              <tr app-table-empty [colSpan]="7">{{ 'admin.empty' | t }}</tr>
            }
          }
        </tbody>
      </table>
    </app-table-wrapper>

    <app-dialog [(open)]="open" [heading]="(editing() ? 'admin.reference.edit' : 'admin.reference.new') | t">
      <form class="grid gap-4 sm:grid-cols-2" (submit)="save($event)">
        @if (actions.error(); as text) {
          <app-alert variant="destructive" class="sm:col-span-2">{{ text }}</app-alert>
        }
        <div>
          <label appLabel for="rf-code" required>{{ 'admin.code' | t }}</label>
          <input appInput id="rf-code" dir="ltr" [disabled]="!!editing()" [value]="d().code" (input)="set('code', $any($event.target).value.trim().toLowerCase())" />
        </div>
        <div>
          <label appLabel for="rf-order">{{ 'admin.reference.order' | t }}</label>
          <input appInput id="rf-order" type="number" dir="ltr" [value]="d().order" (input)="set('order', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="rf-ar" required>{{ 'admin.nameAr' | t }}</label>
          <input appInput id="rf-ar" dir="rtl" [value]="d().nameAr" (input)="set('nameAr', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="rf-en" required>{{ 'admin.nameEn' | t }}</label>
          <input appInput id="rf-en" dir="ltr" [value]="d().nameEn" (input)="set('nameEn', $any($event.target).value)" />
        </div>
        @if (activeType() === 'city') {
          <div>
            <label appLabel for="rf-parent" required>{{ 'crm.customers.fields.governorateCode' | t }}</label>
            <app-select>
              <select appSelect id="rf-parent" [value]="d().parentCode" (change)="set('parentCode', $any($event.target).value)">
                <option value="">—</option>
                @for (option of reference.options('governorate'); track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </app-select>
          </div>
        }
        @if (hasTone()) {
          <div>
            <label appLabel for="rf-tone">{{ 'admin.reference.tone' | t }}</label>
            <app-select>
              <select appSelect id="rf-tone" [value]="d().tone" (change)="set('tone', $any($event.target).value)">
                <option value="">—</option>
                @for (tone of tones; track tone) {
                  <option [value]="tone">{{ 'admin.reference.tones.' + tone | t }}</option>
                }
              </select>
            </app-select>
          </div>
        }
        @if (activeType() === 'pipeline_stage') {
          <div>
            <label appLabel for="rf-prob">{{ 'admin.reference.probability' | t }}</label>
            <input appInput id="rf-prob" type="number" min="0" max="100" dir="ltr" [value]="d().probability" (input)="set('probability', $any($event.target).value)" />
          </div>
        }
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="d().isActive" (change)="setActive($any($event.target).checked)" /> {{ 'admin.active' | t }}</label>
        <div class="flex gap-2 sm:col-span-2">
          <button type="submit" appButton [disabled]="actions.busy() || !valid()">{{ 'crm.common.save' | t }}</button>
          <button type="button" appButton variant="outline" (click)="open.set(false)">{{ 'crm.common.cancel' | t }}</button>
        </div>
      </form>
    </app-dialog>
  `,
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

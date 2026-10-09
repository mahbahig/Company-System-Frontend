import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { CatalogApi } from '../../solar/catalog-api.service';
import { EQUIPMENT_CATEGORIES, type EquipmentItem } from '../../solar/solar.models';

/**
 * §10 equipment catalog: panels, inverters, batteries, mounting, cabling,
 * protection, monitoring and pumps with ratings, reference cost and warranty —
 * the source for BOMs and financial proposals.
 */
@Component({
  selector: 'app-equipment-admin-page',
  imports: [TranslatePipe, EnumLabelPipe, AlertComponent, BadgeComponent, ButtonDirective, DialogComponent, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-page-header [heading]="'admin.equipment.title' | t" [subtitle]="'admin.equipment.subtitle' | t" class="!mb-0">
      <button type="button" appButton (click)="edit(null)">{{ 'admin.equipment.new' | t }}</button>
    </app-page-header>
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    <app-list-toolbar [searchValue]="q() ?? ''" [filters]="filters()" />
    <app-table-wrapper [label]="'admin.equipment.title' | t" [attr.aria-busy]="data.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'admin.code' | t }}</th>
            <th appTableHead>{{ 'admin.equipment.category' | t }}</th>
            <th appTableHead>{{ 'admin.equipment.item' | t }}</th>
            <th appTableHead class="text-end">{{ 'admin.equipment.rating' | t }}</th>
            @if (showCost()) {
              <th appTableHead class="text-end">{{ 'admin.equipment.cost' | t }}</th>
            }
            <th appTableHead>{{ 'admin.equipment.warranty' | t }}</th>
            <th appTableHead>{{ 'admin.users.status' | t }}</th>
            <th appTableHead><span class="sr-only">{{ 'admin.actions' | t }}</span></th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (item of rows(); track item.id) {
            <tr appTableRow>
              <td appTableCell class="font-mono text-xs" dir="ltr">{{ item.code }}</td>
              <td appTableCell>{{ item.category | enum: 'equipmentCategory' }}</td>
              <td appTableCell>
                <span class="font-medium" dir="ltr">{{ item.manufacturer }} {{ item.model }}</span>
                @if (i18n.pick(item.descriptionAr, item.descriptionEn); as desc) {
                  <span class="block max-w-sm truncate text-xs text-muted-foreground">{{ desc }}</span>
                }
              </td>
              <td appTableCell class="tabular text-end">{{ item.rating !== undefined ? i18n.formatNumber(item.rating) + ' ' + (item.ratingUnit ?? '') : '—' }}</td>
              @if (showCost()) {
                <td appTableCell class="tabular text-end">{{ item.referenceCost !== undefined ? i18n.formatMoney(item.referenceCost, item.currency) : '—' }}</td>
              }
              <td appTableCell class="tabular">{{ item.warrantyYears ?? '—' }}</td>
              <td appTableCell><app-badge [tone]="item.isActive ? 'success' : 'neutral'">{{ (item.isActive ? 'admin.active' : 'admin.inactive') | t }}</app-badge></td>
              <td appTableCell><button type="button" appButton variant="ghost" size="sm" (click)="edit(item)">{{ 'crm.common.edit' | t }}</button></td>
            </tr>
          } @empty {
            <tr app-table-empty [colSpan]="8">{{ (data.isLoading() ? 'common.labels.loading' : 'admin.empty') | t }}</tr>
          }
        </tbody>
      </table>
    </app-table-wrapper>
    @if (data.hasValue()) {
      <app-pagination [page]="data.value().page" [pageCount]="data.value().pageCount" [total]="data.value().total" [pageSize]="data.value().pageSize" />
    }

    <app-dialog [(open)]="open" [heading]="(editing() ? 'admin.equipment.edit' : 'admin.equipment.new') | t">
      <form class="grid gap-4 sm:grid-cols-2" (submit)="save($event)">
        @if (actions.error(); as text) {
          <app-alert variant="destructive" class="sm:col-span-2">{{ text }}</app-alert>
        }
        <div>
          <label appLabel for="eq-code" required>{{ 'admin.code' | t }}</label>
          <input appInput id="eq-code" dir="ltr" [disabled]="!!editing()" [value]="d().code" (input)="set('code', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="eq-cat" required>{{ 'admin.equipment.category' | t }}</label>
          <app-select>
            <select appSelect id="eq-cat" [value]="d().category" (change)="set('category', $any($event.target).value)">
              @for (c of categories; track c) {
                <option [value]="c">{{ c | enum: 'equipmentCategory' }}</option>
              }
            </select>
          </app-select>
        </div>
        <div>
          <label appLabel for="eq-man" required>{{ 'admin.equipment.manufacturer' | t }}</label>
          <input appInput id="eq-man" dir="ltr" [value]="d().manufacturer" (input)="set('manufacturer', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="eq-model" required>{{ 'admin.equipment.model' | t }}</label>
          <input appInput id="eq-model" dir="ltr" [value]="d().model" (input)="set('model', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="eq-rating">{{ 'admin.equipment.rating' | t }}</label>
          <input appInput id="eq-rating" type="number" step="any" min="0" dir="ltr" [value]="d().rating" (input)="set('rating', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="eq-unit-r">{{ 'admin.equipment.ratingUnit' | t }}</label>
          <input appInput id="eq-unit-r" dir="ltr" placeholder="W, kW, kWh, A…" [value]="d().ratingUnit" (input)="set('ratingUnit', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="eq-unit">{{ 'admin.equipment.unit' | t }}</label>
          <input appInput id="eq-unit" dir="ltr" placeholder="pcs, m, set" [value]="d().unit" (input)="set('unit', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="eq-warranty">{{ 'admin.equipment.warranty' | t }}</label>
          <input appInput id="eq-warranty" type="number" min="0" dir="ltr" [value]="d().warrantyYears" (input)="set('warrantyYears', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="eq-cost">{{ 'admin.equipment.cost' | t }}</label>
          <input appInput id="eq-cost" type="number" min="0" step="any" dir="ltr" [value]="d().referenceCost" (input)="set('referenceCost', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="eq-cur">{{ 'admin.equipment.currency' | t }}</label>
          <app-select>
            <select appSelect id="eq-cur" [value]="d().currency" (change)="set('currency', $any($event.target).value)">
              @for (c of ['EGP', 'USD', 'EUR']; track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
          </app-select>
        </div>
        <div>
          <label appLabel for="eq-desc-ar">{{ 'admin.equipment.descriptionAr' | t }}</label>
          <input appInput id="eq-desc-ar" dir="rtl" [value]="d().descriptionAr" (input)="set('descriptionAr', $any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="eq-desc-en">{{ 'admin.equipment.descriptionEn' | t }}</label>
          <input appInput id="eq-desc-en" dir="ltr" [value]="d().descriptionEn" (input)="set('descriptionEn', $any($event.target).value)" />
        </div>
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
export class EquipmentAdminPage {
  private readonly api = inject(CatalogApi);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly categories = EQUIPMENT_CATEGORIES;

  readonly q = input<string>();
  readonly category = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly showCost = computed(() => this.auth.can('financials.view_cost') || this.auth.can('pricing.manage'));
  protected readonly data = rxResource({ params: () => ({ q: this.q(), category: this.category(), page: this.page() }), stream: ({ params }) => this.api.list({ ...params, includeInactive: true, pageSize: 50 }) });
  protected readonly rows = computed(() => (this.data.hasValue() ? this.data.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'category', label: this.i18n.t('admin.equipment.category'), options: EQUIPMENT_CATEGORIES.map((value) => ({ value, label: this.i18n.t(`enums.equipmentCategory.${value}`) })), value: this.category() ?? '' },
  ]);

  protected readonly open = signal(false);
  protected readonly editing = signal<string | null>(null);
  protected readonly d = signal(this.blank());
  protected readonly valid = computed(() => /^[a-z0-9_-]+$/i.test(this.d().code) && !!this.d().manufacturer.trim() && !!this.d().model.trim());

  private blank() {
    return { code: '', category: 'panel', manufacturer: '', model: '', rating: '', ratingUnit: '', unit: 'pcs', warrantyYears: '', referenceCost: '', currency: 'EGP', descriptionAr: '', descriptionEn: '', isActive: true };
  }

  protected edit(item: EquipmentItem | null): void {
    this.actions.error.set(null);
    this.editing.set(item?.id ?? null);
    this.d.set(
      item
        ? {
            code: item.code,
            category: item.category,
            manufacturer: item.manufacturer,
            model: item.model,
            rating: item.rating !== undefined ? String(item.rating) : '',
            ratingUnit: item.ratingUnit ?? '',
            unit: item.unit ?? 'pcs',
            warrantyYears: item.warrantyYears !== undefined ? String(item.warrantyYears) : '',
            referenceCost: item.referenceCost !== undefined ? String(item.referenceCost) : '',
            currency: item.currency ?? 'EGP',
            descriptionAr: item.descriptionAr ?? '',
            descriptionEn: item.descriptionEn ?? '',
            isActive: item.isActive,
          }
        : this.blank(),
    );
    this.open.set(true);
  }

  protected set(key: string, value: string): void {
    this.d.update((d) => ({ ...d, [key]: value }));
  }

  protected setActive(value: boolean): void {
    this.d.update((d) => ({ ...d, isActive: value }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    const d = this.d();
    const num = (value: string) => (value === '' ? undefined : Number(value));
    const body = {
      category: d.category,
      manufacturer: d.manufacturer.trim(),
      model: d.model.trim(),
      rating: num(d.rating),
      ratingUnit: d.ratingUnit || undefined,
      unit: d.unit || undefined,
      warrantyYears: num(d.warrantyYears),
      referenceCost: num(d.referenceCost),
      currency: d.currency,
      descriptionAr: d.descriptionAr || undefined,
      descriptionEn: d.descriptionEn || undefined,
      isActive: d.isActive,
    };
    const id = this.editing();
    const request: Observable<EquipmentItem> = id ? this.api.update(id, body) : this.api.create({ ...body, code: d.code.trim() });
    void this.actions.run(request, 'admin.saved', () => {
      this.open.set(false);
      this.data.reload();
    });
  }
}

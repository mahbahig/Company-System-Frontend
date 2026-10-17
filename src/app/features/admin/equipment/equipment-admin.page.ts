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
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';

/**
 * §10 equipment catalog: panels, inverters, batteries, mounting, cabling,
 * protection, monitoring and pumps with ratings, reference cost and warranty —
 * the source for BOMs and financial proposals.
 */
@Component({
  selector: 'app-equipment-admin-page',
  imports: [SkeletonRowComponent, TranslatePipe, EnumLabelPipe, AlertComponent, BadgeComponent, ButtonDirective, DialogComponent, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS, ...FORM_IMPORTS, CreateIconComponent],
  templateUrl: './equipment-admin.page.html',
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
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly showCost = computed(() => this.auth.can('financials.view_cost') || this.auth.can('pricing.manage'));
  /** Reference costs are pricing (CFO, `pricing.manage`); technical specs are `catalog.manage` (Technical Lead). */
  protected readonly canSetCost = computed(() => this.auth.can('pricing.manage'));
  protected readonly data = rxResource({ params: () => ({ q: this.q(), category: this.category(), page: this.page(), pageSize: this.pageSize() }), stream: ({ params }) => this.api.list({ ...params, includeInactive: true, pageSize: 50 }) });
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
      ...(this.canSetCost() ? { referenceCost: num(d.referenceCost) } : {}),
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

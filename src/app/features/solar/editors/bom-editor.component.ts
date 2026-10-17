import { Component, booleanAttribute, computed, inject, input, model } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { CatalogApi } from '../catalog-api.service';
import { EQUIPMENT_CATEGORIES, type BomItem } from '../solar.models';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';

/**
 * TECH-04 bill of materials. Lines can be picked from the equipment catalog
 * (filling manufacturer / model / unit) or typed freely; read-only when the
 * version is locked.
 */
@Component({
  selector: 'app-bom-editor',
  imports: [TranslatePipe, EnumLabelPipe, ButtonDirective, ...FORM_IMPORTS, ...TABLE_IMPORTS, CreateIconComponent],
  templateUrl: './bom-editor.component.html',
  host: { class: 'block' },
})
export class BomEditorComponent {
  private readonly catalog = inject(CatalogApi);
  protected readonly i18n = inject(I18nService);

  readonly items = model<BomItem[]>([]);
  readonly readonly = input(false, { transform: booleanAttribute });
  /** At least one line is needed to submit. */
  readonly requireLine = input(false, { transform: booleanAttribute });
  /** A save / submit was rejected: mark the missing line and any line without a description. */
  readonly flag = input(false, { transform: booleanAttribute });

  protected readonly missingLine = computed(() => this.flag() && this.requireLine() && !this.readonly() && !this.items().some((line) => line.description.trim()));

  protected readonly categories = EQUIPMENT_CATEGORIES;
  private readonly equipment = rxResource({ stream: () => this.catalog.list() });
  private readonly equipmentRows = computed(() => (this.equipment.hasValue() ? this.equipment.value().rows : []));

  protected catalogFor(category: string) {
    return this.equipmentRows().filter((item) => item.category === category);
  }

  protected add(): void {
    this.items.update((items) => [...items, { category: 'panel', description: '', quantity: 1, unit: 'unit' }]);
  }

  protected remove(index: number): void {
    this.items.update((items) => items.filter((_, i) => i !== index));
  }

  protected patch(index: number, changes: Partial<BomItem>): void {
    this.items.update((items) => items.map((item, i) => (i === index ? { ...item, ...changes } : item)));
  }

  protected pick(index: number, equipmentId: string): void {
    const item = this.equipmentRows().find((row) => row.id === equipmentId);
    if (!item) {
      this.patch(index, { equipmentId: null });
      return;
    }
    this.patch(index, {
      equipmentId,
      manufacturer: item.manufacturer,
      model: item.model,
      unit: item.unit,
      description: this.i18n.pick(item.descriptionAr, item.descriptionEn) || `${item.manufacturer} ${item.model}`,
    });
  }
}

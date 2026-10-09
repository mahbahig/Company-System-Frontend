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

/**
 * TECH-04 bill of materials. Lines can be picked from the equipment catalog
 * (filling manufacturer / model / unit) or typed freely; read-only when the
 * version is locked.
 */
@Component({
  selector: 'app-bom-editor',
  imports: [TranslatePipe, EnumLabelPipe, ButtonDirective, ...FORM_IMPORTS, ...TABLE_IMPORTS],
  template: `
    <div [class]="missingLine() ? 'rounded-md ring-2 ring-destructive' : ''">
    <app-table-wrapper [label]="'solar.bom.title' | t">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'solar.bom.category' | t }}</th>
            <th appTableHead>{{ 'solar.bom.item' | t }}</th>
            <th appTableHead>{{ 'solar.bom.description' | t }}</th>
            <th appTableHead>{{ 'solar.bom.quantity' | t }}</th>
            <th appTableHead>{{ 'solar.bom.unit' | t }}</th>
            @if (!readonly()) {
              <th appTableHead><span class="sr-only">{{ 'crm.common.actions' | t }}</span></th>
            }
          </tr>
        </thead>
        <tbody appTableBody>
          @for (line of items(); track $index; let index = $index) {
            <tr appTableRow>
              @if (readonly()) {
                <td appTableCell>{{ line.category | enum: 'equipmentCategory' }}</td>
                <td appTableCell>{{ line.manufacturer }} {{ line.model }}</td>
                <td appTableCell>{{ line.description }}</td>
                <td appTableCell class="tabular">{{ i18n.formatNumber(line.quantity) }}</td>
                <td appTableCell>{{ line.unit }}</td>
              } @else {
                <td appTableCell class="min-w-36">
                  <app-select>
                    <select appSelect [attr.aria-label]="'solar.bom.category' | t" [value]="line.category" (change)="patch(index, { category: $any($event.target).value, equipmentId: null })">
                      @for (category of categories; track category) {
                        <option [value]="category">{{ category | enum: 'equipmentCategory' }}</option>
                      }
                    </select>
                  </app-select>
                </td>
                <td appTableCell class="min-w-52">
                  <app-select>
                    <select appSelect [attr.aria-label]="'solar.bom.item' | t" [value]="line.equipmentId ?? ''" (change)="pick(index, $any($event.target).value)">
                      <option value="">{{ 'solar.bom.custom' | t }}</option>
                      @for (item of catalogFor(line.category); track item.id) {
                        <option [value]="item.id">{{ item.manufacturer }} {{ item.model }}</option>
                      }
                    </select>
                  </app-select>
                </td>
                <td appTableCell class="min-w-52"><input appInput [attr.aria-label]="'solar.bom.description' | t" [attr.aria-invalid]="flag() && !line.description.trim() ? 'true' : null" [value]="line.description" (input)="patch(index, { description: $any($event.target).value })" /></td>
                <td appTableCell class="w-28"><input appInput type="number" min="0" step="any" dir="ltr" [attr.aria-label]="'solar.bom.quantity' | t" [value]="line.quantity" (input)="patch(index, { quantity: +$any($event.target).value })" /></td>
                <td appTableCell class="w-28"><input appInput [attr.aria-label]="'solar.bom.unit' | t" [value]="line.unit ?? ''" (input)="patch(index, { unit: $any($event.target).value })" /></td>
                <td appTableCell><button type="button" appButton variant="ghost" size="sm" (click)="remove(index)">{{ 'crm.common.delete' | t }}</button></td>
              }
            </tr>
          } @empty {
            <tr app-table-empty [colSpan]="readonly() ? 5 : 6">{{ 'solar.bom.empty' | t }}</tr>
          }
        </tbody>
      </table>
    </app-table-wrapper>
    </div>
    @if (missingLine()) {
      <p class="mt-1 text-xs text-destructive" role="alert">{{ 'solar.bom.required' | t }}</p>
    }
    @if (!readonly()) {
      <button type="button" appButton variant="outline" size="sm" class="mt-3" (click)="add()">{{ 'solar.bom.add' | t }}</button>
    }
  `,
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

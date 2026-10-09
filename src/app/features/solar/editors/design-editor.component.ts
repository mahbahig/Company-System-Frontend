import { Component, booleanAttribute, input, model } from '@angular/core';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import type { SystemDesign } from '../solar.models';

type Numeric = 'capacityKwp' | 'expectedAnnualGenerationKwh' | 'specificYield' | 'performanceRatio' | 'expectedSelfConsumptionPct';
type Long = 'mounting' | 'cablingProtection' | 'technicalSpecifications' | 'installationRequirements' | 'scope' | 'assumptions' | 'exclusions' | 'technicalTerms';

/** TECH-03 system design editor: capacity, panels, inverters, batteries, yield, scope and terms. */
@Component({
  selector: 'app-design-editor',
  imports: [TranslatePipe, ButtonDirective, ...FORM_IMPORTS],
  template: `
    <fieldset class="flex flex-col gap-5" [disabled]="readonly()">
      <div class="grid gap-4 sm:grid-cols-3">
        @for (key of numeric; track key) {
          @if (!(hideCapacity() && key === 'capacityKwp')) {
            <div>
              <label appLabel [for]="prefix() + key" [required]="isRequired(key)">{{ 'solar.design.' + key | t }}</label>
              <input appInput type="number" step="any" min="0" dir="ltr" [id]="prefix() + key" [attr.aria-invalid]="invalid(key) ? 'true' : null" [value]="design()[key] ?? ''" (input)="setNumber(key, $any($event.target).value)" />
              @if (invalid(key)) {
                <p class="mt-1 text-xs text-destructive" role="alert">{{ 'common.labels.required' | t }}</p>
              }
            </div>
          }
        }
      </div>

      <div>
        <h3 class="mb-2 text-sm font-semibold">{{ 'solar.design.panels' | t }}</h3>
        <div class="grid gap-3 sm:grid-cols-4">
          <input appInput [attr.aria-label]="'solar.design.manufacturer' | t" [placeholder]="'solar.design.manufacturer' | t" [value]="design().panels?.manufacturer ?? ''" (input)="setPanel('manufacturer', $any($event.target).value)" />
          <input appInput [attr.aria-label]="'solar.design.model' | t" [placeholder]="'solar.design.model' | t" [value]="design().panels?.model ?? ''" (input)="setPanel('model', $any($event.target).value)" />
          <input appInput type="number" dir="ltr" [attr.aria-label]="'solar.design.wattage' | t" [placeholder]="'solar.design.wattage' | t" [value]="design().panels?.wattage ?? ''" (input)="setPanel('wattage', +$any($event.target).value)" />
          <input appInput type="number" dir="ltr" [attr.aria-label]="'solar.design.quantity' | t" [placeholder]="'solar.design.quantity' | t" [value]="design().panels?.quantity ?? ''" (input)="setPanel('quantity', +$any($event.target).value)" />
        </div>
      </div>

      @for (group of groups; track group.key) {
        <div>
          <h3 class="mb-2 text-sm font-semibold">{{ 'solar.design.' + group.key | t }}</h3>
          @for (row of rows(group.key); track $index; let index = $index) {
            <div class="mb-2 grid gap-3 sm:grid-cols-5">
              <input appInput [attr.aria-label]="'solar.design.manufacturer' | t" [placeholder]="'solar.design.manufacturer' | t" [value]="row.manufacturer ?? ''" (input)="setRow(group.key, index, 'manufacturer', $any($event.target).value)" />
              <input appInput [attr.aria-label]="'solar.design.model' | t" [placeholder]="'solar.design.model' | t" [value]="row.model ?? ''" (input)="setRow(group.key, index, 'model', $any($event.target).value)" />
              <input appInput type="number" dir="ltr" [attr.aria-label]="'solar.design.' + group.rating | t" [placeholder]="'solar.design.' + group.rating | t" [value]="$any(row)[group.rating] ?? ''" (input)="setRow(group.key, index, group.rating, +$any($event.target).value)" />
              <input appInput type="number" dir="ltr" [attr.aria-label]="'solar.design.quantity' | t" [placeholder]="'solar.design.quantity' | t" [value]="row.quantity ?? ''" (input)="setRow(group.key, index, 'quantity', +$any($event.target).value)" />
              @if (!readonly()) {
                <button type="button" appButton variant="ghost" size="sm" (click)="removeRow(group.key, index)">{{ 'crm.common.delete' | t }}</button>
              }
            </div>
          }
          @if (!readonly()) {
            <button type="button" appButton variant="outline" size="sm" (click)="addRow(group.key)">{{ 'solar.design.add' | t }}</button>
          }
        </div>
      }

      <div class="grid gap-4 sm:grid-cols-2">
        @for (key of long; track key) {
          <div>
            <label appLabel [for]="prefix() + key" [required]="isRequired(key)">{{ 'solar.design.' + key | t }}</label>
            <textarea appTextarea rows="3" [id]="prefix() + key" [attr.aria-invalid]="invalid(key) ? 'true' : null" [value]="design()[key] ?? ''" (input)="setText(key, $any($event.target).value)"></textarea>
            @if (invalid(key)) {
              <p class="mt-1 text-xs text-destructive" role="alert">{{ 'common.labels.required' | t }}</p>
            }
          </div>
        }
      </div>
    </fieldset>
  `,
  host: { class: 'block' },
})
export class DesignEditorComponent {
  readonly design = model<SystemDesign>({});
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly prefix = input('design-');
  /** Technical proposal: scope, assumptions and exclusions are required to submit. */
  readonly requireTerms = input(false, { transform: booleanAttribute });
  /** The page already has its own required capacity field (technical proposal), so the design's copy is not shown. */
  readonly hideCapacity = input(false, { transform: booleanAttribute });
  /** A save / submit was rejected: mark the required fields that are still empty. */
  readonly flag = input(false, { transform: booleanAttribute });

  protected readonly numeric: Numeric[] = ['capacityKwp', 'expectedAnnualGenerationKwh', 'specificYield', 'performanceRatio', 'expectedSelfConsumptionPct'];
  protected readonly long: Long[] = ['mounting', 'cablingProtection', 'technicalSpecifications', 'installationRequirements', 'scope', 'assumptions', 'exclusions', 'technicalTerms'];
  protected readonly groups = [
    { key: 'inverters' as const, rating: 'ratedKw' },
    { key: 'batteries' as const, rating: 'capacityKwh' },
  ];

  protected isRequired(key: Numeric | Long): boolean {
    if (key === 'capacityKwp' || key === 'expectedAnnualGenerationKwh') return true;
    return this.requireTerms() && (key === 'scope' || key === 'assumptions' || key === 'exclusions');
  }

  protected invalid(key: Numeric | Long): boolean {
    if (!this.flag() || this.readonly() || !this.isRequired(key)) return false;
    const value = this.design()[key];
    return typeof value === 'string' ? !value.trim() : !value;
  }

  protected rows(key: 'inverters' | 'batteries'): Array<{ manufacturer?: string; model?: string; quantity?: number }> {
    return (this.design()[key] ?? []) as Array<{ manufacturer?: string; model?: string; quantity?: number }>;
  }

  protected setNumber(key: Numeric, raw: string): void {
    this.design.update((d) => ({ ...d, [key]: raw === '' ? undefined : Number(raw) }));
  }

  protected setText(key: Long, value: string): void {
    this.design.update((d) => ({ ...d, [key]: value }));
  }

  protected setPanel(key: string, value: string | number): void {
    this.design.update((d) => ({ ...d, panels: { ...(d.panels ?? {}), [key]: value } }));
  }

  protected setRow(group: 'inverters' | 'batteries', index: number, key: string, value: string | number): void {
    this.design.update((d) => ({ ...d, [group]: (d[group] ?? []).map((row, i) => (i === index ? { ...row, [key]: value } : row)) }));
  }

  protected addRow(group: 'inverters' | 'batteries'): void {
    this.design.update((d) => ({ ...d, [group]: [...(d[group] ?? []), {}] }));
  }

  protected removeRow(group: 'inverters' | 'batteries', index: number): void {
    this.design.update((d) => ({ ...d, [group]: (d[group] ?? []).filter((_, i) => i !== index) }));
  }
}
